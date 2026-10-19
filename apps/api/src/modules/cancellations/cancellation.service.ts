import { prisma } from '../../config/database.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../common/errors/app-error.js';
import { BookingStatus } from '@localman/constants';
import {
  CancelBookingInput,
  CancellationResultDto,
  RecordNoShowInput,
  NoShowResultDto,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { cancellationPolicyService } from './cancellation-policy.service.js';
import { refundService } from '../refunds/refund.service.js';
import { financialService } from '../financial/financial.service.js';
import { realtimeService } from '../realtime/realtime.service.js';
import { notificationService } from '../notifications/notification.service.js';
import { dispatchService } from '../dispatch/dispatch.service.js';

export class CancellationService {
  /**
   * Customer initiates cancellation with authoritative policy evaluation,
   * fee deduction, refund orchestration, and realtime notification.
   */
  async cancelCustomerBooking(
    customer: AuthenticatedUser,
    bookingId: string,
    input: CancelBookingInput
  ): Promise<CancellationResultDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: { include: { refunds: true } },
        provider: { include: { user: true } },
        dispatchOffers: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // 1. Authorization: Only booking owner can cancel as customer
    if (booking.customerId !== customer.id) {
      throw new ForbiddenError('Unauthorized: you can only cancel your own bookings.');
    }

    // 2. Idempotency Guard
    if (booking.currentStatus === BookingStatus.CANCELLED) {
      return {
        bookingId: booking.id,
        bookingStatus: BookingStatus.CANCELLED,
        cancellationStatus: 'COMPLETED',
        cancellationReason: booking.cancellationReason || input.reason,
        cancelledBy: booking.cancelledBy || customer.id,
        cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : new Date().toISOString(),
        cancellationFeePaisa: 0,
        refundAmountPaisa: 0,
        refundStatus: 'NOT_REQUIRED',
        policyExplanation: 'Booking was already cancelled.',
      };
    }

    // 3. Policy Evaluation
    const evaluation = cancellationPolicyService.evaluateCustomerCancellation(booking);
    if (!evaluation.isAllowed) {
      throw new BadRequestError(evaluation.blockReason || 'Booking cannot be cancelled in current state.');
    }

    const cancelledAt = new Date();

    // 4. Update Booking and record History inside transaction
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          currentStatus: BookingStatus.CANCELLED,
          cancelledBy: customer.id,
          cancelledAt,
          cancellationReason: input.reason,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState: booking.currentStatus as any,
          toState: BookingStatus.CANCELLED as any,
          actorId: customer.id,
          actorRole: 'CUSTOMER',
          reason: input.reason,
          metadata: {
            feePaisa: evaluation.cancellationFeePaisa,
            refundPaisa: evaluation.refundAmountPaisa,
            notes: input.notes || null,
          },
        },
      });

      // Cancel any active dispatch offers
      await tx.dispatchOffer.updateMany({
        where: {
          bookingId: booking.id,
          status: 'OFFERED',
        },
        data: {
          status: 'CANCELLED',
        },
      });
    });

    // 5. Handle Refund if applicable
    let refundStatus = 'NOT_REQUIRED';
    if (
      evaluation.refundAmountPaisa > 0 &&
      booking.payment &&
      (booking.payment.status === 'CAPTURED' || booking.payment.status === 'REFUNDED')
    ) {
      try {
        const refundResult = await refundService.processRefund({
          bookingId: booking.id,
          amountPaisa: evaluation.refundAmountPaisa,
          reason: `Customer cancellation refund: ${input.reason}`,
          initiatedBy: customer.id,
          idempotencyKey: input.idempotencyKey,
        });
        refundStatus = refundResult.status;
      } catch (err: any) {
        console.error('[CancellationService] Refund processing error:', err.message);
        refundStatus = 'FAILED';
      }
    }

    // 6. Handle Provider Compensation if fee was deducted and provider was assigned
    if (evaluation.providerCompensationPaisa > 0 && booking.providerId) {
      try {
        await financialService.creditProviderCompensation(
          booking.providerId,
          booking.id,
          evaluation.providerCompensationPaisa,
          `Customer cancellation compensation (${evaluation.policyExplanation})`
        );
      } catch (err: any) {
        console.error('[CancellationService] Provider compensation credit error:', err.message);
      }
    }

    // 7. Emit Realtime Events
    realtimeService.publishToBooking(booking.id, {
      type: 'BOOKING_CANCELLED',
      payload: {
        bookingId: booking.id,
        cancelledBy: customer.id,
        actorRole: 'CUSTOMER',
        reason: input.reason,
        feePaisa: evaluation.cancellationFeePaisa,
        refundPaisa: evaluation.refundAmountPaisa,
        timestamp: cancelledAt.toISOString(),
      },
    });

    realtimeService.publishToBooking(booking.id, {
      type: 'JOB_STATUS_CHANGED',
      payload: {
        bookingId: booking.id,
        fromState: booking.currentStatus,
        toState: BookingStatus.CANCELLED,
        timestamp: cancelledAt.toISOString(),
      },
    });

    // 8. Notifications
    try {
      if (booking.provider) {
        await notificationService.notifyBookingCancelled(
          booking.provider.userId,
          booking.bookingNumber,
          input.reason
        );
      }
    } catch {
      // Non-blocking notification
    }

    return {
      bookingId: booking.id,
      bookingStatus: BookingStatus.CANCELLED,
      cancellationStatus: 'COMPLETED',
      cancellationReason: input.reason,
      cancelledBy: customer.id,
      cancelledAt: cancelledAt.toISOString(),
      cancellationFeePaisa: evaluation.cancellationFeePaisa,
      refundAmountPaisa: evaluation.refundAmountPaisa,
      refundStatus,
      policyExplanation: evaluation.policyExplanation,
    };
  }

  /**
   * Provider initiates cancellation before job start.
   * Product rule: Returns booking to REQUESTED and triggers redispatch for customer,
   * with zero cancellation penalty to customer.
   */
  async cancelProviderBooking(
    providerUser: AuthenticatedUser,
    bookingId: string,
    input: CancelBookingInput
  ): Promise<CancellationResultDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { include: { user: true } },
        payment: { include: { refunds: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // 1. Authorization: Only assigned provider can cancel as provider
    if (booking.provider?.userId !== providerUser.id) {
      throw new ForbiddenError('Unauthorized: you are not the assigned provider for this booking.');
    }

    // 2. Policy Evaluation
    const evaluation = cancellationPolicyService.evaluateProviderCancellation(booking);
    if (!evaluation.isAllowed) {
      throw new BadRequestError(evaluation.blockReason || 'Partner cannot cancel booking in current state.');
    }

    const cancelledAt = new Date();

    // 3. Return booking to REQUESTED queue and clear providerId for redispatch
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          currentStatus: BookingStatus.REQUESTED,
          providerId: null,
          cancelledBy: providerUser.id,
          cancellationReason: `Provider cancellation: ${input.reason}`,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState: booking.currentStatus as any,
          toState: BookingStatus.REQUESTED as any,
          actorId: providerUser.id,
          actorRole: 'PROVIDER',
          reason: `Partner cancelled appointment (${input.reason}). Booking returned to dispatch queue.`,
        },
      });
    });

    // 4. Trigger Redispatch to find another local expert
    try {
      const offer = await dispatchService.dispatchBooking(booking.id);
      realtimeService.emitToBooking(booking.id, 'DISPATCH_STARTED', {
        bookingId: booking.id,
        attemptNumber: 1,
        hasEligibleCandidate: !!offer,
      });
    } catch (dispatchErr) {
      console.error('[CancellationService] Redispatch after provider cancellation failed:', dispatchErr);
    }

    // 5. Emit Realtime Events
    realtimeService.publishToBooking(booking.id, {
      type: 'JOB_STATUS_CHANGED',
      payload: {
        bookingId: booking.id,
        fromState: booking.currentStatus,
        toState: BookingStatus.REQUESTED,
        timestamp: cancelledAt.toISOString(),
      },
    });

    return {
      bookingId: booking.id,
      bookingStatus: BookingStatus.REQUESTED,
      cancellationStatus: 'REASSIGNING',
      cancellationReason: input.reason,
      cancelledBy: providerUser.id,
      cancelledAt: cancelledAt.toISOString(),
      cancellationFeePaisa: 0,
      refundAmountPaisa: 0,
      refundStatus: 'NOT_REQUIRED',
      policyExplanation: 'Partner cancelled the appointment. System has returned your request to dispatch to find a replacement expert.',
    };
  }

  /**
   * Records No-Show (either Customer No-Show recorded by arrived provider,
   * or Provider No-Show reported by waiting customer).
   */
  async recordNoShow(
    actor: AuthenticatedUser,
    bookingId: string,
    input: RecordNoShowInput
  ): Promise<NoShowResultDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { include: { user: true } },
        payment: { include: { refunds: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === actor.id;
    const isProvider = booking.provider?.userId === actor.id;
    const isAdmin = actor.roles.includes('ADMIN');

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenError('Unauthorized to record no-show for this booking.');
    }

    const recordedAt = new Date();

    // -------------------------------------------------------------------------
    // Case A: Customer No-Show (Initiated by Arrived Provider)
    // -------------------------------------------------------------------------
    if (isProvider || (isAdmin && booking.currentStatus === BookingStatus.ARRIVED)) {
      if (booking.currentStatus !== BookingStatus.ARRIVED) {
        throw new BadRequestError(
          `Customer no-show can only be recorded after provider has marked ARRIVED. Current status is '${booking.currentStatus}'.`
        );
      }

      // Check arrival waiting period
      const arrivalHistory = booking.statusHistory.find(
        (h) => h.toState === BookingStatus.ARRIVED
      );
      const arrivalTime = arrivalHistory ? new Date(arrivalHistory.createdAt) : new Date(booking.updatedAt);
      const elapsedMinutes = Math.floor((Date.now() - arrivalTime.getTime()) / 60000);
      const requiredWaitMinutes = cancellationPolicyService.getConfig().customerNoShowWaitMinutes;

      if (elapsedMinutes < requiredWaitMinutes && (input.waitingMinutes || 0) < requiredWaitMinutes) {
        throw new BadRequestError(
          `Required waiting period of ${requiredWaitMinutes} minutes has not elapsed since arrival. Elapsed: ${elapsedMinutes} minute(s).`
        );
      }

      const evaluation = cancellationPolicyService.evaluateCustomerNoShow(booking);

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            currentStatus: BookingStatus.NO_SHOW,
            cancellationReason: `Customer No-Show: ${input.reason}`,
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromState: booking.currentStatus as any,
            toState: BookingStatus.NO_SHOW as any,
            actorId: actor.id,
            actorRole: 'PROVIDER',
            reason: `Customer No-Show after ${elapsedMinutes} min wait: ${input.reason}`,
            metadata: {
              elapsedMinutes,
              feePaisa: evaluation.cancellationFeePaisa,
              compensationPaisa: evaluation.providerCompensationPaisa,
            },
          },
        });
      });

      // Provider Compensation
      if (evaluation.providerCompensationPaisa > 0 && booking.providerId) {
        try {
          await financialService.creditProviderCompensation(
            booking.providerId,
            booking.id,
            evaluation.providerCompensationPaisa,
            `Customer no-show compensation after ${elapsedMinutes} min wait`
          );
        } catch (err: any) {
          console.error('[CancellationService] No-show compensation credit error:', err.message);
        }
      }

      // Customer Partial Refund if paid
      if (
        evaluation.refundAmountPaisa > 0 &&
        booking.payment &&
        booking.payment.status === 'CAPTURED'
      ) {
        try {
          await refundService.processRefund({
            bookingId: booking.id,
            amountPaisa: evaluation.refundAmountPaisa,
            reason: `Customer no-show refund (fee deducted): ${input.reason}`,
            initiatedBy: actor.id,
          });
        } catch (err: any) {
          console.error('[CancellationService] No-show refund error:', err.message);
        }
      }

      realtimeService.publishToBooking(booking.id, {
        type: 'NO_SHOW_RECORDED',
        payload: {
          bookingId: booking.id,
          noShowActor: 'CUSTOMER',
          recordedBy: actor.id,
          feePaisa: evaluation.cancellationFeePaisa,
          compensationPaisa: evaluation.providerCompensationPaisa,
          timestamp: recordedAt.toISOString(),
        },
      });

      return {
        bookingId: booking.id,
        noShowActor: 'CUSTOMER',
        recordedBy: actor.id,
        recordedAt: recordedAt.toISOString(),
        feePaisa: evaluation.cancellationFeePaisa,
        compensationPaisa: evaluation.providerCompensationPaisa,
        refundAmountPaisa: evaluation.refundAmountPaisa,
        bookingStatus: BookingStatus.NO_SHOW,
        explanation: evaluation.policyExplanation,
      };
    }

    // -------------------------------------------------------------------------
    // Case B: Provider No-Show (Reported by Customer)
    // -------------------------------------------------------------------------
    const eligiblePreArrivalStatuses = [
      BookingStatus.CONFIRMED,
      BookingStatus.PROVIDER_ACCEPTED,
      BookingStatus.PROVIDER_ON_THE_WAY,
    ];

    if (!eligiblePreArrivalStatuses.includes(booking.currentStatus as any)) {
      throw new BadRequestError(
        `Provider no-show can only be reported for confirmed/en-route appointments where partner failed to arrive. Current status is '${booking.currentStatus}'.`
      );
    }

    const evaluation = cancellationPolicyService.evaluateProviderNoShow(booking);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          currentStatus: BookingStatus.NO_SHOW,
          cancellationReason: `Provider No-Show reported: ${input.reason}`,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState: booking.currentStatus as any,
          toState: BookingStatus.NO_SHOW as any,
          actorId: actor.id,
          actorRole: 'CUSTOMER',
          reason: `Partner failed to arrive: ${input.reason}`,
        },
      });
    });

    // Full 100% refund to customer if payment was captured
    if (
      evaluation.refundAmountPaisa > 0 &&
      booking.payment &&
      booking.payment.status === 'CAPTURED'
    ) {
      try {
        await refundService.processRefund({
          bookingId: booking.id,
          amountPaisa: evaluation.refundAmountPaisa,
          reason: `Partner no-show full refund: ${input.reason}`,
          initiatedBy: actor.id,
        });
      } catch (err: any) {
        console.error('[CancellationService] Provider no-show refund error:', err.message);
      }
    }

    realtimeService.publishToBooking(booking.id, {
      type: 'NO_SHOW_RECORDED',
      payload: {
        bookingId: booking.id,
        noShowActor: 'PROVIDER',
        recordedBy: actor.id,
        feePaisa: 0,
        compensationPaisa: 0,
        refundPaisa: evaluation.refundAmountPaisa,
        timestamp: recordedAt.toISOString(),
      },
    });

    return {
      bookingId: booking.id,
      noShowActor: 'PROVIDER',
      recordedBy: actor.id,
      recordedAt: recordedAt.toISOString(),
      feePaisa: 0,
      compensationPaisa: 0,
      refundAmountPaisa: evaluation.refundAmountPaisa,
      bookingStatus: BookingStatus.NO_SHOW,
      explanation: evaluation.policyExplanation,
    };
  }
}

export const cancellationService = new CancellationService();
