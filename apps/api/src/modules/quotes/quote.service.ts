import { prisma } from '../../config/database.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  ValidationError,
} from '../../common/errors/app-error.js';
import {
  BookingStatus,
  QuoteStatus,
  PricingModel,
} from '@localman/constants';
import {
  SubmitQuoteInput,
  UpdateQuoteInput,
  AcceptQuoteInput,
  RejectQuoteInput,
  WithdrawQuoteInput,
  QuoteResponseDto,
  QuoteListResponseDto,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { matchingService } from '../dispatch/matching.service.js';
import { FinancialService } from '../financial/financial.service.js';
import { realtimeService } from '../realtime/realtime.service.js';
import { BookingFSM } from '../bookings/booking-fsm.js';

class BookingLockManager {
  private locks = new Map<string, Promise<void>>();

  async runWithLock<T>(bookingId: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(bookingId)) {
      await this.locks.get(bookingId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(bookingId, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(bookingId);
      resolveLock();
    }
  }
}

export class QuoteService {
  private lockManager = new BookingLockManager();

  /**
   * Helper to map a raw DB quote to QuoteResponseDto
   */
  private mapToQuoteDto(quote: any): QuoteResponseDto {
    const isExpired =
      quote.status === QuoteStatus.EXPIRED ||
      (quote.validUntil && new Date(quote.validUntil).getTime() <= Date.now() &&
        (quote.status === QuoteStatus.SUBMITTED || quote.status === QuoteStatus.UPDATED));

    const effectiveStatus =
      isExpired && (quote.status === QuoteStatus.SUBMITTED || quote.status === QuoteStatus.UPDATED)
        ? QuoteStatus.EXPIRED
        : quote.status;

    const providerUser = quote.provider?.user;
    return {
      id: quote.id,
      bookingId: quote.bookingId,
      providerId: quote.providerId,
      provider: {
        id: quote.providerId,
        businessName: quote.provider?.businessName || null,
        fullName: providerUser?.fullName || null,
        avatarUrl: providerUser?.avatarUrl || null,
        ratingAverage: Number(quote.provider?.ratingAverage || 5.0),
        ratingCount: quote.provider?.ratingCount || 0,
        experienceYears: quote.provider?.experienceYears || 0,
      },
      status: effectiveStatus as any,
      subtotalPaisa: quote.subtotalPaisa || quote.quoteAmountPaisa || 0,
      materialsPaisa: quote.materialsPaisa || 0,
      taxPaisa: quote.taxPaisa || 0,
      totalAmountPaisa: quote.quoteAmountPaisa || 0,
      estimatedDurationMinutes:
        quote.estimatedDurationMinutes ||
        (quote.estimatedHours ? Math.round(Number(quote.estimatedHours) * 60) : 60),
      breakdownNotes: quote.breakdownNotes || null,
      items: quote.items || null,
      validUntil: quote.validUntil
        ? new Date(quote.validUntil).toISOString()
        : new Date(Date.now() + 86400000).toISOString(),
      version: quote.version || 1,
      isExpired: Boolean(isExpired),
      createdAt: quote.createdAt ? new Date(quote.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: quote.updatedAt ? new Date(quote.updatedAt).toISOString() : new Date().toISOString(),
      acceptedAt: quote.acceptedAt ? new Date(quote.acceptedAt).toISOString() : null,
      rejectedAt: quote.rejectedAt ? new Date(quote.rejectedAt).toISOString() : null,
    };
  }

  /**
   * Provider submits a quote proposal for an eligible booking
   */
  async submitQuote(
    providerUser: AuthenticatedUser,
    bookingId: string,
    input: SubmitQuoteInput
  ): Promise<QuoteResponseDto> {
    // 1. Fetch provider record
    const provider = await prisma.provider.findUnique({
      where: { userId: providerUser.id },
      include: {
        user: true,
        services: true,
        serviceAreas: true,
        bookings: {
          where: {
            currentStatus: {
              in: [
                BookingStatus.PROVIDER_ON_THE_WAY,
                BookingStatus.ARRIVED,
                BookingStatus.JOB_STARTED,
                BookingStatus.JOB_EXTENDED,
              ],
            },
          },
        },
      },
    });

    if (!provider) {
      throw new ForbiddenError('Provider profile not found.');
    }

    // 2. Fetch booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        address: true,
        customer: true,
        provider: true,
        quotes: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    // 3. Pricing model check: only CUSTOM_QUOTE or INSPECTION_QUOTE allow quoting
    const pricingModel = booking.service.pricingModel;
    if (
      pricingModel !== PricingModel.CUSTOM_QUOTE &&
      pricingModel !== PricingModel.INSPECTION_QUOTE
    ) {
      throw new BadRequestError(
        `Quotations are only permitted for CUSTOM_QUOTE or INSPECTION_QUOTE services. Service model is '${pricingModel}'.`
      );
    }

    // 4. Lifecycle state checks
    if (pricingModel === PricingModel.CUSTOM_QUOTE) {
      if (booking.currentStatus !== BookingStatus.REQUESTED) {
        throw new BadRequestError(
          `Cannot submit quote: booking is in '${booking.currentStatus}' state and no longer accepting proposals.`
        );
      }
      if (booking.providerId && booking.providerId !== provider.id) {
        throw new BadRequestError('This custom job has already been assigned to another partner.');
      }
    } else if (pricingModel === PricingModel.INSPECTION_QUOTE) {
      // For inspection quote, provider may be already assigned for the inspection phase
      if (booking.providerId && booking.providerId !== provider.id) {
        throw new ForbiddenError('Only the assigned inspection partner can submit the final quotation.');
      }
    }

    // 5. Anti-self-booking check
    if (booking.customerId === provider.userId) {
      throw new ForbiddenError('Partners cannot submit quotes on their own service requests.');
    }

    // 6. Provider Eligibility Check via matching engine
    const eligibility = await matchingService.checkEligibility(provider.id, booking.id);
    if (!eligibility.isEligible) {
      throw new ForbiddenError(`Partner ineligible to quote: ${eligibility.reason}`);
    }

    // 7. Prevent duplicate active quotes from the same partner
    const existingActiveQuote = booking.quotes.find(
      (q: any) =>
        q.providerId === provider.id &&
        (q.status === QuoteStatus.SUBMITTED || q.status === QuoteStatus.UPDATED)
    );
    if (existingActiveQuote) {
      if (input.idempotencyKey && (existingActiveQuote as any).idempotencyKey === input.idempotencyKey) {
        return this.mapToQuoteDto(existingActiveQuote);
      }
      throw new ConflictError(
        'You have already submitted an active quote for this booking. Use the revision endpoint to edit it.'
      );
    }

    // 8. Server-authoritative financial calculation & bounds validation
    const subtotalPaisa =
      input.subtotalPaisa ??
      input.quoteAmountPaisa ??
      (input.totalAmountPaisa ? input.totalAmountPaisa - (input.materialsPaisa || 0) : 0);

    const materialsPaisa = input.materialsPaisa || 0;
    const taxPaisa = input.taxPaisa || 0;
    const totalAmountPaisa = input.totalAmountPaisa ?? (subtotalPaisa + materialsPaisa + taxPaisa);

    if (totalAmountPaisa <= 0) {
      throw new ValidationError('Quote total must be greater than zero paisa.');
    }
    if (totalAmountPaisa > 50000000) {
      throw new ValidationError('Quote total exceeds maximum allowed threshold of ₹5,00,000.');
    }

    // If itemized items are provided, validate that item totals do not exceed total
    if (input.items && input.items.length > 0) {
      const itemsSum = input.items.reduce((acc, curr) => acc + curr.totalPaisa, 0);
      if (itemsSum > totalAmountPaisa) {
        throw new ValidationError('Sum of itemized quote items cannot exceed the total quoted amount.');
      }
    }

    const durationMinutes =
      input.estimatedDurationMinutes ||
      (input.estimatedHours ? Math.round(Number(input.estimatedHours) * 60) : 60);

    const validityMinutes = input.validityMinutes || 1440;
    const validUntil = new Date(Date.now() + validityMinutes * 60 * 1000);

    // 9. Persist Quote
    const created = await prisma.bookingQuote.create({
      data: {
        bookingId: booking.id,
        providerId: provider.id,
        quoteAmountPaisa: totalAmountPaisa,
        subtotalPaisa,
        materialsPaisa,
        taxPaisa,
        breakdownNotes: input.breakdownNotes,
        estimatedDurationMinutes: durationMinutes,
        estimatedHours: input.estimatedHours || durationMinutes / 60,
        items: (input.items as any) || null,
        status: QuoteStatus.SUBMITTED,
        validUntil,
        version: 1,
      },
      include: {
        provider: {
          include: { user: true },
        },
      },
    });

    // 10. Emit Realtime event
    realtimeService.publish(`booking:${booking.id}`, 'QUOTE_SUBMITTED', {
      bookingId: booking.id,
      quoteId: created.id,
      providerId: provider.id,
      totalAmountPaisa,
      validUntil: validUntil.toISOString(),
    });
    realtimeService.publish(`customer:${booking.customerId}`, 'QUOTE_SUBMITTED', {
      bookingId: booking.id,
      quoteId: created.id,
      providerId: provider.id,
      totalAmountPaisa,
    });

    return this.mapToQuoteDto(created);
  }

  /**
   * Provider revises an active quote before customer acceptance
   */
  async updateQuote(
    providerUser: AuthenticatedUser,
    quoteId: string,
    input: UpdateQuoteInput
  ): Promise<QuoteResponseDto> {
    const quote = await prisma.bookingQuote.findUnique({
      where: { id: quoteId },
      include: {
        provider: { include: { user: true } },
        booking: { include: { service: true } },
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found.');
    }

    // Ownership check (IDOR protection)
    if (quote.provider.userId !== providerUser.id) {
      throw new ForbiddenError('Unauthorized: You can only edit your own quotes.');
    }

    // State check
    if (quote.status !== QuoteStatus.SUBMITTED && quote.status !== QuoteStatus.UPDATED) {
      throw new BadRequestError(
        `Cannot revise quote in '${quote.status}' status. Only active quotes may be updated.`
      );
    }

    // Expiry check
    if (quote.validUntil && new Date(quote.validUntil).getTime() <= Date.now()) {
      await prisma.bookingQuote.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.EXPIRED },
      });
      throw new BadRequestError('Cannot revise an expired quote.');
    }

    // Recompute values
    const subtotalPaisa = input.subtotalPaisa ?? quote.subtotalPaisa;
    const materialsPaisa = input.materialsPaisa ?? quote.materialsPaisa;
    const taxPaisa = input.taxPaisa ?? quote.taxPaisa;
    const totalAmountPaisa =
      input.totalAmountPaisa ??
      (input.subtotalPaisa !== undefined || input.materialsPaisa !== undefined || input.taxPaisa !== undefined
        ? subtotalPaisa + materialsPaisa + taxPaisa
        : quote.quoteAmountPaisa);

    if (totalAmountPaisa <= 0) {
      throw new ValidationError('Quote total must be greater than zero paisa.');
    }
    if (totalAmountPaisa > 50000000) {
      throw new ValidationError('Quote total exceeds maximum allowed threshold of ₹5,00,000.');
    }

    const durationMinutes =
      input.estimatedDurationMinutes ??
      quote.estimatedDurationMinutes ??
      60;

    const validUntil = input.validityMinutes
      ? new Date(Date.now() + input.validityMinutes * 60 * 1000)
      : quote.validUntil;

    const updated = await prisma.bookingQuote.update({
      where: { id: quote.id },
      data: {
        quoteAmountPaisa: totalAmountPaisa,
        subtotalPaisa,
        materialsPaisa,
        taxPaisa,
        breakdownNotes: input.breakdownNotes ?? quote.breakdownNotes,
        estimatedDurationMinutes: durationMinutes,
        estimatedHours: durationMinutes / 60,
        items: input.items !== undefined ? (input.items as any) : quote.items,
        status: QuoteStatus.UPDATED,
        validUntil,
        version: (quote.version || 1) + 1,
      },
      include: {
        provider: { include: { user: true } },
      },
    });

    realtimeService.publish(`booking:${quote.bookingId}`, 'QUOTE_UPDATED', {
      bookingId: quote.bookingId,
      quoteId: updated.id,
      version: updated.version,
      totalAmountPaisa: updated.quoteAmountPaisa,
    });

    return this.mapToQuoteDto(updated);
  }

  /**
   * Provider withdraws active quote
   */
  async withdrawQuote(
    providerUser: AuthenticatedUser,
    quoteId: string,
    input?: WithdrawQuoteInput
  ): Promise<QuoteResponseDto> {
    const quote = await prisma.bookingQuote.findUnique({
      where: { id: quoteId },
      include: {
        provider: { include: { user: true } },
        booking: true,
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found.');
    }

    if (quote.provider.userId !== providerUser.id) {
      throw new ForbiddenError('Unauthorized: You can only withdraw your own quote.');
    }

    if (quote.status !== QuoteStatus.SUBMITTED && quote.status !== QuoteStatus.UPDATED) {
      throw new BadRequestError(`Cannot withdraw quote in '${quote.status}' status.`);
    }

    const withdrawn = await prisma.bookingQuote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.WITHDRAWN,
        rejectedAt: new Date(),
        breakdownNotes: input?.reason
          ? `${quote.breakdownNotes || ''} [Withdrawn: ${input.reason}]`
          : quote.breakdownNotes,
      },
      include: {
        provider: { include: { user: true } },
      },
    });

    realtimeService.publish(`booking:${quote.bookingId}`, 'QUOTE_WITHDRAWN', {
      bookingId: quote.bookingId,
      quoteId: quote.id,
      providerId: quote.providerId,
    });

    return this.mapToQuoteDto(withdrawn);
  }

  /**
   * Query all quotes submitted for a booking
   */
  async getQuotesForBooking(
    user: AuthenticatedUser,
    bookingId: string
  ): Promise<QuoteListResponseDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        service: true,
        provider: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    const isCustomer = booking.customerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    let providerProfile: any = null;
    if (user.roles.includes('PROVIDER')) {
      providerProfile = await prisma.provider.findUnique({ where: { userId: user.id } });
    }

    if (!isCustomer && !isAdmin && !providerProfile) {
      throw new ForbiddenError('Unauthorized: You cannot access quotes for this booking.');
    }

    // Build filter: Customers & Admins see all active quotes; Providers see only their own quote
    const whereClause: any = { bookingId };
    if (!isCustomer && !isAdmin && providerProfile) {
      whereClause.providerId = providerProfile.id;
    }

    const rawQuotes = await prisma.bookingQuote.findMany({
      where: whereClause,
      include: {
        provider: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const quotes = rawQuotes.map((q: any) => this.mapToQuoteDto(q));
    const acceptedQuote = quotes.find((q) => q.status === QuoteStatus.ACCEPTED);

    return {
      quotes,
      bookingId: booking.id,
      pricingModel: booking.service.pricingModel,
      acceptedQuoteId: acceptedQuote ? acceptedQuote.id : null,
    };
  }

  /**
   * Query specific quote by ID with IDOR protection
   */
  async getQuoteById(user: AuthenticatedUser, quoteId: string): Promise<QuoteResponseDto> {
    const quote = await prisma.bookingQuote.findUnique({
      where: { id: quoteId },
      include: {
        provider: { include: { user: true } },
        booking: { include: { customer: true } },
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found.');
    }

    const isCustomer = quote.booking.customerId === user.id;
    const isOwnerProvider = quote.provider.userId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isCustomer && !isOwnerProvider && !isAdmin) {
      throw new ForbiddenError('Unauthorized: You do not have permission to view this quote.');
    }

    return this.mapToQuoteDto(quote);
  }

  /**
   * Customer accepts exactly one quote atomically
   * Concurrent acceptances result in exactly one winner
   */
  async acceptQuote(
    customerUser: AuthenticatedUser,
    bookingId: string,
    quoteId: string,
    _input?: AcceptQuoteInput
  ): Promise<{ booking: any; quote: QuoteResponseDto }> {
    // 1. Fetch initial booking record
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        customer: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    // 2. Ownership verification (Customer IDOR protection)
    if (booking.customerId !== customerUser.id) {
      throw new ForbiddenError('Unauthorized: You can only accept quotes for your own booking.');
    }

    // 3. Atomic Database Transaction with Row Locking and Intra-process mutex
    return await this.lockManager.runWithLock(bookingId, async () => {
      return await prisma.$transaction(async (tx) => {
        // Re-fetch booking inside transaction
        const lockedBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { service: true },
        });

        if (!lockedBooking) {
          throw new NotFoundError('Booking not found in transaction.');
        }

        // Check if any quote is ALREADY accepted for this booking
        const existingAccepted = await tx.bookingQuote.findFirst({
          where: {
            bookingId,
            status: QuoteStatus.ACCEPTED,
          },
          include: { provider: { include: { user: true } } },
        });

        if (existingAccepted) {
          if (existingAccepted.id === quoteId) {
            // Idempotent retry: customer re-accepting the same winning quote
            return {
              booking: lockedBooking,
              quote: this.mapToQuoteDto(existingAccepted),
            };
          }
          // Conflict: Another quote already won the race
          throw new ConflictError(
            'Another quote has already been accepted for this booking. Exactly one quote can be accepted.'
          );
        }

        // Check target quote
        const targetQuote = await tx.bookingQuote.findUnique({
          where: { id: quoteId },
          include: {
            provider: { include: { user: true } },
          },
        });

        if (!targetQuote || targetQuote.bookingId !== bookingId) {
          throw new NotFoundError('Target quote not found on this booking.');
        }

        // Verify quote status
        if (
          targetQuote.status !== QuoteStatus.SUBMITTED &&
          targetQuote.status !== QuoteStatus.UPDATED
        ) {
          throw new BadRequestError(
            `Cannot accept quote in '${targetQuote.status}' status. Quote must be active.`
          );
        }

        // Verify validity/expiry timestamp
        if (targetQuote.validUntil && new Date(targetQuote.validUntil).getTime() <= Date.now()) {
          await tx.bookingQuote.update({
            where: { id: targetQuote.id },
            data: { status: QuoteStatus.EXPIRED },
          });
          throw new BadRequestError('Cannot accept an expired quote.');
        }

        // Canonical financial derivations via FinancialService
        const platformCommissionPercent =
          Number(targetQuote.provider?.commissionRateOverride) ||
          Number(lockedBooking.service?.platformCommissionPercent) ||
          FinancialService.DEFAULT_COMMISSION_PERCENT;

        const baseAmountPaisa = targetQuote.subtotalPaisa || targetQuote.quoteAmountPaisa;
        const platformFeePaisa = FinancialService.calculatePlatformFee(baseAmountPaisa, platformCommissionPercent);
        const totalAmountPaisa = targetQuote.quoteAmountPaisa;
        const providerEarningPaisa = Math.max(0, totalAmountPaisa - platformFeePaisa);

        // Create Immutable Accepted Pricing Snapshot
        const acceptedAt = new Date();
        const pricingSnapshot = {
          pricingModel: lockedBooking.service?.pricingModel || 'CUSTOM_QUOTE',
          quoteId: targetQuote.id,
          providerId: targetQuote.providerId,
          subtotalPaisa: baseAmountPaisa,
          materialsPaisa: targetQuote.materialsPaisa || 0,
          taxAmountPaisa: targetQuote.taxPaisa || 0,
          totalAmountPaisa,
          platformFeePaisa,
          providerEarningPaisa,
          platformCommissionPercent,
          acceptedAt: acceptedAt.toISOString(),
          items: targetQuote.items || [],
          breakdownNotes: targetQuote.breakdownNotes,
        };

        // FSM Transition validation
        const targetBookingState =
          lockedBooking.currentStatus === BookingStatus.REQUESTED
            ? BookingStatus.CONFIRMED
            : (lockedBooking.currentStatus as any);

        if (targetBookingState !== lockedBooking.currentStatus) {
          BookingFSM.validateTransition({
            bookingId: lockedBooking.id,
            currentState: lockedBooking.currentStatus as any,
            targetState: targetBookingState,
            actorId: customerUser.id,
            actorRoles: customerUser.roles,
            actorRole: 'CUSTOMER',
            isCustomer: true,
            isAssignedProvider: false,
            isAdmin: false,
          });
        }

        // Mark winning quote ACCEPTED
        const winningQuote = await tx.bookingQuote.update({
          where: { id: targetQuote.id },
          data: {
            status: QuoteStatus.ACCEPTED,
            acceptedAt,
          },
          include: {
            provider: { include: { user: true } },
          },
        });

        // Reject all competing active quotes for this booking
        await tx.bookingQuote.updateMany({
          where: {
            bookingId,
            id: { not: targetQuote.id },
            status: { in: [QuoteStatus.SUBMITTED, QuoteStatus.UPDATED] },
          },
          data: {
            status: QuoteStatus.REJECTED,
            rejectedAt: acceptedAt,
          },
        });

        // Update Booking with authoritative pricing and assigned provider
        const updatedBooking = await tx.booking.update({
          where: { id: lockedBooking.id },
          data: {
            providerId: targetQuote.providerId,
            currentStatus: targetBookingState,
            totalAmountPaisa,
            baseAmountPaisa,
            taxAmountPaisa: targetQuote.taxPaisa || 0,
            platformFeePaisa,
            providerEarningPaisa,
            pricingSnapshot,
          },
        });

        // Status history record
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: lockedBooking.id,
            fromState: lockedBooking.currentStatus as any,
            toState: targetBookingState as any,
            actorId: customerUser.id,
            actorRole: 'CUSTOMER',
            reason: `Customer accepted quote ${targetQuote.id} (Total: ₹${(totalAmountPaisa / 100).toFixed(2)})`,
            metadata: {
              quoteId: targetQuote.id,
              providerId: targetQuote.providerId,
              totalAmountPaisa,
            },
          },
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            userId: customerUser.id,
            action: 'ACCEPT_QUOTE',
            resourceType: 'BOOKING_QUOTE',
            resourceId: targetQuote.id,
            oldState: { currentStatus: lockedBooking.currentStatus },
            newState: {
              currentStatus: targetBookingState,
              quoteStatus: QuoteStatus.ACCEPTED,
              providerId: targetQuote.providerId,
              totalAmountPaisa,
            },
          },
        });

        // Realtime notification
        realtimeService.publish(`booking:${lockedBooking.id}`, 'QUOTE_ACCEPTED', {
          bookingId: lockedBooking.id,
          quoteId: targetQuote.id,
          providerId: targetQuote.providerId,
          totalAmountPaisa,
        });
        realtimeService.publish(`provider:${targetQuote.providerId}`, 'QUOTE_ACCEPTED', {
          bookingId: lockedBooking.id,
          quoteId: targetQuote.id,
          totalAmountPaisa,
        });

        return {
          booking: updatedBooking,
          quote: this.mapToQuoteDto(winningQuote),
        };
      });
    });
  }

  /**
   * Customer declines/rejects a specific quote
   */
  async rejectQuote(
    customerUser: AuthenticatedUser,
    bookingId: string,
    quoteId: string,
    input?: RejectQuoteInput
  ): Promise<QuoteResponseDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.customerId !== customerUser.id) {
      throw new ForbiddenError('Unauthorized: You can only reject quotes for your own booking.');
    }

    const quote = await prisma.bookingQuote.findUnique({
      where: { id: quoteId },
      include: { provider: { include: { user: true } } },
    });
    if (!quote || quote.bookingId !== bookingId) {
      throw new NotFoundError('Quote not found.');
    }

    if (quote.status !== QuoteStatus.SUBMITTED && quote.status !== QuoteStatus.UPDATED) {
      throw new BadRequestError(`Cannot reject quote in '${quote.status}' status.`);
    }

    const rejected = await prisma.bookingQuote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.REJECTED,
        rejectedAt: new Date(),
        breakdownNotes: input?.reason
          ? `${quote.breakdownNotes || ''} [Declined: ${input.reason}]`
          : quote.breakdownNotes,
      },
      include: { provider: { include: { user: true } } },
    });

    realtimeService.publish(`provider:${quote.providerId}`, 'QUOTE_REJECTED', {
      bookingId,
      quoteId: quote.id,
    });

    return this.mapToQuoteDto(rejected);
  }

  /**
   * Background / Admin sweep to expire stale quotes
   */
  async expireStaleQuotes(): Promise<{ expiredCount: number }> {
    const now = new Date();
    const staleQuotes = await prisma.bookingQuote.findMany({
      where: {
        status: { in: [QuoteStatus.SUBMITTED, QuoteStatus.UPDATED] },
        validUntil: { lte: now },
      },
    });

    if (staleQuotes.length === 0) {
      return { expiredCount: 0 };
    }

    await prisma.bookingQuote.updateMany({
      where: {
        id: { in: staleQuotes.map((q) => q.id) },
      },
      data: {
        status: QuoteStatus.EXPIRED,
      },
    });

    for (const q of staleQuotes) {
      realtimeService.publish(`booking:${q.bookingId}`, 'QUOTE_EXPIRED', {
        bookingId: q.bookingId,
        quoteId: q.id,
        providerId: q.providerId,
      });
    }

    return { expiredCount: staleQuotes.length };
  }
}

export const quoteService = new QuoteService();
