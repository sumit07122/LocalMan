import { prisma } from '../../config/database.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  BadRequestError,
} from '../../common/errors/app-error.js';
import { BookingStatus } from '@localman/constants';
import { PaymentService } from '../payments/payment.service.js';
import { financialService } from '../financial/financial.service.js';
import { realtimeService } from '../realtime/realtime.service.js';
import { RefundResultDto } from '@localman/contracts';

export interface ProcessRefundParams {
  bookingId: string;
  amountPaisa?: number; // If omitted, full remaining amount is refunded
  reason: string;
  initiatedBy: string;
  idempotencyKey?: string;
  adminUserId?: string;
}

export class RefundService {
  private paymentService: PaymentService;

  constructor(paymentService?: PaymentService) {
    this.paymentService = paymentService || new PaymentService();
  }

  public setPaymentService(service: PaymentService): void {
    this.paymentService = service;
  }

  /**
   * Orchestrates server-authoritative full or partial customer refund
   */
  async processRefund(params: ProcessRefundParams): Promise<RefundResultDto> {
    const { bookingId, reason, initiatedBy, idempotencyKey, adminUserId } = params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: {
          include: {
            refunds: true,
          },
        },
        provider: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const payment = booking.payment;
    if (!payment) {
      throw new BadRequestError('No payment record found for this booking. Refund cannot be issued.');
    }

    if (payment.status !== 'CAPTURED' && payment.status !== 'REFUNDED') {
      throw new BadRequestError(
        `Payment is in '${payment.status}' state and has not been captured. Refund cannot be issued.`
      );
    }

    // 1. Calculate remaining refundable amount
    const previouslyRefundedPaisa = payment.refunds
      .filter((r) => r.status === 'SUCCEEDED' || r.status === 'PROCESSING')
      .reduce((sum, r) => sum + r.amountPaisa, 0);

    const remainingRefundablePaisa = Math.max(0, payment.amountPaisa - previouslyRefundedPaisa);

    if (remainingRefundablePaisa <= 0) {
      throw new ConflictError('This payment has already been fully refunded.');
    }

    // 2. Validate refund amount
    const targetRefundPaisa =
      params.amountPaisa !== undefined && params.amountPaisa !== null
        ? Math.round(params.amountPaisa)
        : remainingRefundablePaisa;

    if (targetRefundPaisa <= 0) {
      throw new ValidationError('Refund amount must be greater than zero.');
    }

    if (targetRefundPaisa > remainingRefundablePaisa) {
      throw new ValidationError(
        `Requested refund of ₹${(targetRefundPaisa / 100).toFixed(2)} exceeds remaining refundable balance of ₹${(remainingRefundablePaisa / 100).toFixed(2)}.`
      );
    }

    // 3. Idempotency Check
    if (idempotencyKey) {
      const existingRefund = await prisma.refund.findFirst({
        where: {
          paymentId: payment.id,
          reason: { contains: `[idempotency:${idempotencyKey}]` },
        },
      });

      if (existingRefund) {
        return {
          refundId: existingRefund.id,
          paymentId: payment.id,
          bookingId: booking.id,
          originalAmountPaisa: payment.amountPaisa,
          refundAmountPaisa: existingRefund.amountPaisa,
          remainingRefundablePaisa: Math.max(
            0,
            payment.amountPaisa - previouslyRefundedPaisa
          ),
          gatewayRefundId: existingRefund.gatewayRefundId,
          status: existingRefund.status,
          reason: existingRefund.reason,
          initiatedBy: existingRefund.initiatedBy,
          createdAt: existingRefund.createdAt.toISOString(),
        };
      }
    }

    // 4. Emit REFUND_PROCESSING realtime event
    realtimeService.publishToBooking(booking.id, {
      type: 'REFUND_PROCESSING',
      payload: {
        bookingId: booking.id,
        paymentId: payment.id,
        amountPaisa: targetRefundPaisa,
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    // 5. Call Gateway Refund Adapter
    const gateway = this.paymentService.getAdapter();
    const gatewayResult = await gateway.processRefund({
      gatewayPaymentId: payment.gatewayPaymentId || `pay_mock_${payment.id}`,
      amountPaisa: targetRefundPaisa,
      reason,
    });

    // 6. Execute Atomic Transaction: Database Refund + Booking/Payment state
    const refundRecordReason = idempotencyKey ? `${reason} [idempotency:${idempotencyKey}]` : reason;

    const result = await prisma.$transaction(async (tx) => {
      // Create Refund record
      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          amountPaisa: targetRefundPaisa,
          reason: refundRecordReason,
          initiatedBy,
          status: 'SUCCEEDED',
          gatewayRefundId: gatewayResult.gatewayRefundId,
        },
      });

      const newTotalRefunded = previouslyRefundedPaisa + targetRefundPaisa;
      const isFullyRefunded = newTotalRefunded >= payment.amountPaisa;

      if (isFullyRefunded) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED' },
        });

        // Update booking status to REFUNDED if not already terminal
        await tx.booking.update({
          where: { id: booking.id },
          data: { currentStatus: BookingStatus.REFUNDED },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromState: booking.currentStatus as any,
            toState: BookingStatus.REFUNDED as any,
            actorId: initiatedBy,
            actorRole: adminUserId ? 'ADMIN' : 'SYSTEM',
            reason: `Booking fully refunded (₹${(targetRefundPaisa / 100).toFixed(2)}): ${reason}`,
          },
        });
      }

      // 7. Adjust Provider Ledger & Wallet via FinancialService
      await financialService.processRefundAdjustment(
        booking.id,
        targetRefundPaisa,
        reason,
        adminUserId,
        tx
      );

      return refund;
    });

    // 8. Emit REFUND_COMPLETED realtime event
    realtimeService.publishToBooking(booking.id, {
      type: 'REFUND_COMPLETED',
      payload: {
        bookingId: booking.id,
        paymentId: payment.id,
        refundId: result.id,
        amountPaisa: targetRefundPaisa,
        remainingRefundablePaisa: remainingRefundablePaisa - targetRefundPaisa,
        gatewayRefundId: result.gatewayRefundId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      refundId: result.id,
      paymentId: payment.id,
      bookingId: booking.id,
      originalAmountPaisa: payment.amountPaisa,
      refundAmountPaisa: targetRefundPaisa,
      remainingRefundablePaisa: remainingRefundablePaisa - targetRefundPaisa,
      gatewayRefundId: result.gatewayRefundId,
      status: result.status,
      reason: result.reason,
      initiatedBy: result.initiatedBy,
      createdAt: result.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves refund history for a booking
   */
  async getBookingRefunds(bookingId: string) {
    const payment = await prisma.payment.findUnique({
      where: { bookingId },
      include: {
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) return [];
    return payment.refunds;
  }
}

export const refundService = new RefundService();
