import { prisma } from '../../config/database.js';
import { matchingService } from './matching.service.js';
import { notificationService } from '../notifications/notification.service.js';
import { realtimeService } from '../realtime/realtime.service.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../../common/errors/app-error.js';

export const DISPATCH_TIMEOUT_SECONDS = 60; // 60 seconds provider review window
export const MAX_DISPATCH_ATTEMPTS = 5; // Maximum reassignments before marking unavailable

export class DispatchService {
  /**
   * Dispatches an unassigned booking to the highest ranked eligible provider
   */
  async dispatchBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        address: true,
        customer: true,
        dispatchOffers: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Only unassigned bookings in REQUESTED status can be dispatched
    if (booking.currentStatus !== 'REQUESTED' || booking.providerId !== null) {
      return null;
    }

    // Check if there is already an active, unexpired offer for this booking
    const activeOffer = booking.dispatchOffers.find(
      (o) => o.status === 'OFFERED' && new Date(o.expiresAt) > new Date()
    );
    if (activeOffer) {
      return activeOffer;
    }

    // Exclude providers who previously rejected or had expired offers for this booking
    const excludedProviderIds = booking.dispatchOffers
      .filter((o) => o.status === 'REJECTED' || o.status === 'EXPIRED')
      .map((o) => o.providerId);

    // Find and rank eligible candidates
    const candidates = await matchingService.findEligibleProviders(
      booking.id,
      excludedProviderIds
    );

    if (candidates.length === 0) {
      // No more eligible providers available
      realtimeService.emitToBooking(booking.id, 'DISPATCH_FAILED', {
        bookingId: booking.id,
        reason: 'No eligible providers available in service area',
      });
      await notificationService.notifyCustomerNoProvider(booking.customerId, booking.bookingNumber);
      return null;
    }

    const selectedCandidate = candidates[0];
    const attemptNumber = booking.dispatchOffers.length + 1;
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_SECONDS * 1000);

    // Atomically create the dispatch offer
    const offer = await prisma.dispatchOffer.create({
      data: {
        bookingId: booking.id,
        providerId: selectedCandidate.providerId,
        status: 'OFFERED',
        attemptNumber,
        expiresAt,
      },
      include: {
        booking: {
          include: {
            service: true,
            address: true,
          },
        },
        provider: {
          include: {
            user: true,
          },
        },
      },
    });

    // Notify provider in real-time and via notification adapter
    await notificationService.notifyProviderNewOffer(
      selectedCandidate.userId,
      selectedCandidate.providerId,
      booking.bookingNumber,
      booking.service.name,
      offer.id
    );

    return offer;
  }

  /**
   * Provider accepts a dispatch offer with strict concurrency and state protections
   */
  async acceptOffer(userId: string, offerId: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    // Execute atomic claim in database transaction
    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.dispatchOffer.findUnique({
        where: { id: offerId },
        include: {
          booking: {
            include: {
              service: true,
              address: true,
              customer: true,
            },
          },
        },
      });

      if (!offer) {
        throw new NotFoundError('Dispatch offer not found');
      }

      // Security Check: Provider ownership verification
      if (offer.providerId !== provider.id) {
        throw new ForbiddenError('Access denied: You are not the recipient of this job offer.');
      }

      // Idempotency: If already accepted by this provider, return successfully
      if (offer.status === 'ACCEPTED' && offer.booking.providerId === provider.id) {
        return { booking: offer.booking, offer, alreadyClaimed: true };
      }

      // State check: Must be in OFFERED status
      if (offer.status !== 'OFFERED') {
        throw new ConflictError(
          `This offer cannot be accepted because it is ${offer.status.toLowerCase()}.`
        );
      }

      // Expiration check: Server deadline is authoritative
      if (new Date(offer.expiresAt) <= new Date()) {
        await tx.dispatchOffer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        });
        throw new ValidationError('Dispatch offer has expired. You cannot accept an expired offer.');
      }

      // Re-validate provider eligibility
      const eligibility = await matchingService.checkEligibility(provider.id, offer.bookingId);
      if (!eligibility.isEligible) {
        throw new ValidationError(
          `Cannot accept job: ${eligibility.reason || 'Provider is currently ineligible'}`
        );
      }

      // Booking check: Must be REQUESTED and unassigned
      const freshBooking = await tx.booking.findUnique({
        where: { id: offer.bookingId },
      });

      if (!freshBooking) {
        throw new NotFoundError('Booking no longer exists');
      }

      // Atomically assign booking to provider and advance FSM with conditional check
      const claimResult = await tx.booking.updateMany({
        where: {
          id: freshBooking.id,
          currentStatus: 'REQUESTED',
          providerId: null,
        },
        data: {
          providerId: provider.id,
          currentStatus: 'PROVIDER_ACCEPTED',
        },
      });

      if (claimResult.count === 0) {
        // Race condition: another provider claimed the booking first
        await tx.dispatchOffer.update({
          where: { id: offer.id },
          data: { status: 'CANCELLED' },
        });
        throw new ConflictError(
          'This booking has already been claimed by another service partner.'
        );
      }

      const updatedBooking = await tx.booking.findUnique({
        where: { id: freshBooking.id },
        include: {
          service: true,
          address: true,
          customer: true,
        },
      });

      if (!updatedBooking) {
        throw new NotFoundError('Booking no longer exists');
      }

      // Update winning offer to ACCEPTED
      const updatedOffer = await tx.dispatchOffer.update({
        where: { id: offer.id },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });

      // Cancel all other pending offers for this booking
      await tx.dispatchOffer.updateMany({
        where: {
          bookingId: freshBooking.id,
          id: { not: offer.id },
          status: 'OFFERED',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // Record immutable booking status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: freshBooking.id,
          fromState: 'REQUESTED',
          toState: 'PROVIDER_ACCEPTED',
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: 'Provider claimed and accepted real-time dispatch offer',
        },
      });

      return { booking: updatedBooking, offer: updatedOffer, alreadyClaimed: false };
    });

    if (!result.alreadyClaimed) {
      // Emit real-time events and notify customer
      realtimeService.emitToBooking(result.booking.id, 'BOOKING_ACCEPTED', {
        bookingId: result.booking.id,
        providerId: provider.id,
        providerName: provider.businessName || provider.user.fullName || 'Service Partner',
      });

      realtimeService.emitToBooking(result.booking.id, 'PROVIDER_ASSIGNED', {
        bookingId: result.booking.id,
        providerId: provider.id,
        providerName: provider.businessName || provider.user.fullName || 'Service Partner',
        ratingAverage: Number(provider.ratingAverage),
        status: 'PROVIDER_ACCEPTED',
      });

      await notificationService.notifyCustomerBookingAccepted(
        result.booking.customerId,
        result.booking.bookingNumber,
        provider.businessName || provider.user.fullName || 'Service Partner'
      );
    }

    return result;
  }

  /**
   * Provider rejects a dispatch offer; triggers immediate redispatch to next candidate
   */
  async rejectOffer(userId: string, offerId: string, reason?: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const offer = await prisma.dispatchOffer.findUnique({
      where: { id: offerId },
      include: { booking: true },
    });

    if (!offer) {
      throw new NotFoundError('Dispatch offer not found');
    }

    if (offer.providerId !== provider.id) {
      throw new ForbiddenError('Access denied: You are not the recipient of this job offer.');
    }

    // Idempotent: If already rejected, return gracefully
    if (offer.status === 'REJECTED') {
      return { offer, alreadyRejected: true };
    }

    if (offer.status !== 'OFFERED') {
      throw new ConflictError(`Cannot reject an offer that is ${offer.status.toLowerCase()}.`);
    }

    const updatedOffer = await prisma.dispatchOffer.update({
      where: { id: offer.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Declined by service partner',
        respondedAt: new Date(),
      },
    });

    realtimeService.emitToProvider(provider.id, 'BOOKING_REJECTED', {
      offerId: offer.id,
      bookingId: offer.bookingId,
    });

    // Trigger immediate redispatch to next eligible provider in the background
    this.dispatchBooking(offer.bookingId).catch((err) => {
      console.error(`[DispatchService] Redispatch failed for booking ${offer.bookingId}:`, err);
    });

    return { offer: updatedOffer, alreadyRejected: false };
  }

  /**
   * Scans and expires stale dispatch offers where expiresAt has passed;
   * reassigns affected bookings to the next eligible candidates.
   */
  async expireStaleOffers() {
    const now = new Date();
    const staleOffers = await prisma.dispatchOffer.findMany({
      where: {
        status: 'OFFERED',
        expiresAt: { lte: now },
      },
      include: {
        booking: true,
        provider: { include: { user: true } },
      },
    });

    let expiredCount = 0;

    for (const offer of staleOffers) {
      await prisma.dispatchOffer.update({
        where: { id: offer.id },
        data: { status: 'EXPIRED' },
      });

      expiredCount++;

      // Notify provider that offer has timed out
      await notificationService.notifyProviderOfferExpired(
        offer.provider.userId,
        offer.providerId,
        offer.booking.bookingNumber
      );

      // Attempt redispatch to the next eligible candidate if booking is still unassigned
      if (offer.booking.currentStatus === 'REQUESTED' && offer.booking.providerId === null) {
        await this.dispatchBooking(offer.bookingId);
      }
    }

    return { expiredCount };
  }

  /**
   * Fetches active pending offer for the authenticated provider
   */
  async getActiveOfferForProvider(userId: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const activeOffer = await prisma.dispatchOffer.findFirst({
      where: {
        providerId: provider.id,
        status: 'OFFERED',
        expiresAt: { gt: new Date() },
      },
      include: {
        booking: {
          include: {
            service: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activeOffer;
  }

  /**
   * Fetches historical offers for the authenticated provider
   */
  async getOffersForProvider(
    userId: string,
    status?: string,
    limit = 20,
    offset = 0
  ) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const where: any = { providerId: provider.id };
    if (status) {
      where.status = status;
    }

    const [offers, total] = await Promise.all([
      prisma.dispatchOffer.findMany({
        where,
        include: {
          booking: {
            include: {
              service: true,
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.dispatchOffer.count({ where }),
    ]);

    return { offers, total, limit, offset };
  }

  /**
   * Get dispatch status for a specific booking (customer / admin view)
   */
  async getBookingDispatchStatus(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        dispatchOffers: {
          orderBy: { attemptNumber: 'desc' },
          include: {
            provider: {
              select: {
                id: true,
                businessName: true,
                ratingAverage: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const currentOffer = booking.dispatchOffers.find(
      (o) => o.status === 'OFFERED' && new Date(o.expiresAt) > new Date()
    );

    return {
      bookingId: booking.id,
      currentStatus: booking.currentStatus,
      isAssigned: booking.providerId !== null,
      providerId: booking.providerId,
      activeOffer: currentOffer
        ? {
            id: currentOffer.id,
            expiresAt: currentOffer.expiresAt,
            attemptNumber: currentOffer.attemptNumber,
          }
        : null,
      totalAttempts: booking.dispatchOffers.length,
      offers: booking.dispatchOffers,
    };
  }
}

export const dispatchService = new DispatchService();
