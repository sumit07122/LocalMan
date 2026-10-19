import { prisma } from '../../config/database.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../common/errors/app-error.js';
import { BookingStatus, DisputeStatus } from '@localman/constants';
import {
  CreateDisputeInput,
  ResolveDisputeInput,
  DisputeResponseDto,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { refundService } from '../refunds/refund.service.js';
import { financialService } from '../financial/financial.service.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class DisputeService {
  /**
   * Opens a formal customer or provider dispute ticket against a booking
   */
  async openDispute(
    user: AuthenticatedUser,
    input: CreateDisputeInput
  ): Promise<DisputeResponseDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        provider: { include: { user: true } },
        complaints: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === user.id;
    const isProvider = booking.provider?.userId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    // 1. Authorization: Only customer, assigned provider, or admin can raise dispute
    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenError('Unauthorized: you can only open disputes for your own bookings.');
    }

    // 2. Prevent duplicate open disputes on the same booking
    const activeDispute = booking.complaints.find(
      (c) => c.status === DisputeStatus.OPEN || c.status === DisputeStatus.UNDER_REVIEW
    );
    if (activeDispute) {
      throw new ConflictError(
        `An active dispute (${activeDispute.ticketNumber}) is already open for this booking.`
      );
    }

    // 3. Lifecycle state gate: Cannot dispute unaccepted or already refunded/cancelled bookings
    const eligibleStates = [
      BookingStatus.JOB_STARTED,
      BookingStatus.JOB_EXTENDED,
      BookingStatus.JOB_COMPLETED,
      BookingStatus.PAYMENT_PENDING,
      BookingStatus.PAYMENT_SETTLED,
      BookingStatus.REVIEWED,
      BookingStatus.NO_SHOW,
      BookingStatus.DISPUTED,
    ];

    if (!eligibleStates.includes(booking.currentStatus as any)) {
      throw new BadRequestError(
        `Disputes can only be opened for active, completed, or no-show bookings. Current status is '${booking.currentStatus}'.`
      );
    }

    // 4. Generate unique ticket number
    const timestampStr = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const ticketNumber = `DSP-${timestampStr}-${randomSuffix}`;
    const actorRole = isCustomer ? 'CUSTOMER' : isProvider ? 'PROVIDER' : 'ADMIN';

    // 5. Atomic transaction: create complaint ticket and advance booking to DISPUTED
    const createdComplaint = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.create({
        data: {
          ticketNumber,
          bookingId: booking.id,
          raisedBy: user.id,
          category: input.reason,
          description: input.description,
          priority: 'HIGH',
          status: DisputeStatus.OPEN,
        },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          currentStatus: BookingStatus.DISPUTED,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState: booking.currentStatus as any,
          toState: BookingStatus.DISPUTED as any,
          actorId: user.id,
          actorRole,
          reason: `Formal dispute opened (${ticketNumber}): ${input.reason}`,
          metadata: {
            ticketNumber,
            reason: input.reason,
            disputedAmountPaisa: input.disputedAmountPaisa || null,
          },
        },
      });

      return complaint;
    });

    // 6. Emit Realtime event
    realtimeService.publishToBooking(booking.id, {
      type: 'DISPUTE_OPENED',
      payload: {
        bookingId: booking.id,
        disputeId: createdComplaint.id,
        ticketNumber: createdComplaint.ticketNumber,
        openedBy: user.id,
        actorRole,
        reason: input.reason,
        timestamp: createdComplaint.createdAt.toISOString(),
      },
    });

    return {
      id: createdComplaint.id,
      ticketNumber: createdComplaint.ticketNumber,
      bookingId: booking.id,
      raisedBy: createdComplaint.raisedBy,
      actorRole,
      category: createdComplaint.category,
      description: createdComplaint.description,
      priority: createdComplaint.priority,
      status: createdComplaint.status,
      disputedAmountPaisa: input.disputedAmountPaisa,
      assignedTo: createdComplaint.assignedTo,
      resolutionNotes: createdComplaint.resolutionNotes,
      resolvedAt: createdComplaint.resolvedAt ? createdComplaint.resolvedAt.toISOString() : null,
      createdAt: createdComplaint.createdAt.toISOString(),
      updatedAt: createdComplaint.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves disputes for a booking with IDOR protection
   */
  async getDisputesForBooking(
    user: AuthenticatedUser,
    bookingId: string
  ): Promise<DisputeResponseDto[]> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { include: { user: true } },
        complaints: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === user.id;
    const isProvider = booking.provider?.userId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenError('Unauthorized: you cannot view disputes for this booking.');
    }

    return booking.complaints.map((c) => ({
      id: c.id,
      ticketNumber: c.ticketNumber,
      bookingId: booking.id,
      raisedBy: c.raisedBy,
      actorRole: c.raisedBy === booking.customerId ? 'CUSTOMER' : 'PROVIDER',
      category: c.category,
      description: c.description,
      priority: c.priority,
      status: c.status,
      assignedTo: c.assignedTo,
      resolutionNotes: c.resolutionNotes,
      resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves single dispute by ID with IDOR protection
   */
  async getDisputeById(
    user: AuthenticatedUser,
    disputeId: string
  ): Promise<DisputeResponseDto> {
    const complaint = await prisma.complaint.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            provider: { include: { user: true } },
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundError('Dispute ticket not found');
    }

    const booking = complaint.booking;
    const isOwner = complaint.raisedBy === user.id;
    const isCustomer = booking?.customerId === user.id;
    const isProvider = booking?.provider?.userId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isOwner && !isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenError('Unauthorized: you do not have permission to view this dispute.');
    }

    return {
      id: complaint.id,
      ticketNumber: complaint.ticketNumber,
      bookingId: complaint.bookingId || '',
      raisedBy: complaint.raisedBy,
      actorRole: complaint.raisedBy === booking?.customerId ? 'CUSTOMER' : 'PROVIDER',
      category: complaint.category,
      description: complaint.description,
      priority: complaint.priority,
      status: complaint.status,
      assignedTo: complaint.assignedTo,
      resolutionNotes: complaint.resolutionNotes,
      resolvedAt: complaint.resolvedAt ? complaint.resolvedAt.toISOString() : null,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: complaint.updatedAt.toISOString(),
    };
  }

  /**
   * Admin dispute queue listing
   */
  async listAdminDisputes(query: { status?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { fullName: true, phoneNumber: true } },
              provider: { select: { businessName: true, user: { select: { fullName: true } } } },
              payment: true,
            },
          },
        },
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Admin resolves dispute ticket with optional customer refund and provider financial debit
   */
  async resolveDispute(
    adminUser: AuthenticatedUser,
    disputeId: string,
    input: ResolveDisputeInput
  ): Promise<DisputeResponseDto> {
    const complaint = await prisma.complaint.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            payment: { include: { refunds: true } },
            provider: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundError('Dispute ticket not found');
    }

    const booking = complaint.booking;
    if (!booking) {
      throw new NotFoundError('Associated booking for dispute not found');
    }

    // 1. Conflict Check: Dispute already closed
    if (
      complaint.status === DisputeStatus.CLOSED ||
      complaint.status === DisputeStatus.RESOLVED_CUSTOMER ||
      complaint.status === DisputeStatus.RESOLVED_PROVIDER ||
      complaint.status === DisputeStatus.RESOLVED_PARTIAL
    ) {
      throw new ConflictError('This dispute has already been resolved and closed.');
    }

    const resolvedAt = new Date();

    // 2. Handle Customer Refund if specified
    let refundResult = null;
    if (input.refundAmountPaisa && input.refundAmountPaisa > 0) {
      refundResult = await refundService.processRefund({
        bookingId: booking.id,
        amountPaisa: input.refundAmountPaisa,
        reason: `Dispute resolution (${complaint.ticketNumber}): ${input.resolutionNotes}`,
        initiatedBy: adminUser.id,
        adminUserId: adminUser.id,
      });
    }

    // 3. Handle Provider Debit Adjustment if specified
    if (input.providerDebitPaisa && input.providerDebitPaisa > 0 && booking.providerId) {
      await financialService.processRefundAdjustment(
        booking.id,
        input.providerDebitPaisa,
        `Dispute resolution debit (${complaint.ticketNumber}): ${input.resolutionNotes}`,
        adminUser.id
      );
    }

    // 4. Determine Post-Resolution Booking Status
    let nextBookingStatus = booking.currentStatus;
    if (refundResult && refundResult.status === 'SUCCEEDED' && refundResult.remainingRefundablePaisa === 0) {
      nextBookingStatus = BookingStatus.REFUNDED;
    } else if (booking.payment && booking.payment.status === 'CAPTURED') {
      nextBookingStatus = BookingStatus.PAYMENT_SETTLED;
    } else {
      nextBookingStatus = BookingStatus.JOB_COMPLETED;
    }

    // 5. Update Complaint and Booking inside transaction
    const updatedComplaint = await prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          status: input.resolution,
          resolutionNotes: input.resolutionNotes,
          resolvedAt,
          assignedTo: adminUser.id,
        },
      });

      if (booking.currentStatus !== nextBookingStatus) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { currentStatus: nextBookingStatus as any },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromState: booking.currentStatus as any,
            toState: nextBookingStatus as any,
            actorId: adminUser.id,
            actorRole: 'ADMIN',
            reason: `Dispute ${complaint.ticketNumber} resolved (${input.resolution}): ${input.resolutionNotes}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'ADMIN_RESOLVE_DISPUTE',
          resourceType: 'dispute',
          resourceId: complaint.id,
          newState: {
            ticketNumber: complaint.ticketNumber,
            resolution: input.resolution,
            notes: input.resolutionNotes,
            refundPaisa: input.refundAmountPaisa || 0,
            providerDebitPaisa: input.providerDebitPaisa || 0,
            bookingStatus: nextBookingStatus,
          },
        },
      });

      return updated;
    });

    // 6. Emit Realtime event
    realtimeService.publishToBooking(booking.id, {
      type: 'DISPUTE_RESOLVED',
      payload: {
        bookingId: booking.id,
        disputeId: updatedComplaint.id,
        ticketNumber: updatedComplaint.ticketNumber,
        resolution: input.resolution,
        resolvedBy: adminUser.id,
        notes: input.resolutionNotes,
        timestamp: resolvedAt.toISOString(),
      },
    });

    return {
      id: updatedComplaint.id,
      ticketNumber: updatedComplaint.ticketNumber,
      bookingId: booking.id,
      raisedBy: updatedComplaint.raisedBy,
      actorRole: updatedComplaint.raisedBy === booking.customerId ? 'CUSTOMER' : 'PROVIDER',
      category: updatedComplaint.category,
      description: updatedComplaint.description,
      priority: updatedComplaint.priority,
      status: updatedComplaint.status,
      assignedTo: updatedComplaint.assignedTo,
      resolutionNotes: updatedComplaint.resolutionNotes,
      resolvedAt: resolvedAt.toISOString(),
      createdAt: (updatedComplaint.createdAt ? new Date(updatedComplaint.createdAt) : new Date()).toISOString(),
      updatedAt: (updatedComplaint.updatedAt ? new Date(updatedComplaint.updatedAt) : new Date()).toISOString(),
    };
  }
}

export const disputeService = new DisputeService();
