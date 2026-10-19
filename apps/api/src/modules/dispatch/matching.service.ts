import { prisma } from '../../config/database.js';
import { locationService } from '../location/location.service.js';

export interface EligibleCandidate {
  providerId: string;
  userId: string;
  businessName: string | null;
  distanceKm?: number;
  freshnessStatus?: string;
  ratingAverage: number;
  ratingCount: number;
  score: number;
}

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
}

export interface IMatchingScorer {
  calculateScore(candidate: {
    distanceKm?: number;
    ratingAverage: number;
    ratingCount: number;
    experienceYears: number;
  }): number;
}

export class DefaultMatchingScorer implements IMatchingScorer {
  calculateScore(candidate: {
    distanceKm?: number;
    ratingAverage: number;
    ratingCount: number;
    experienceYears: number;
  }): number {
    let score = candidate.ratingAverage * 20; // 0-100 base from rating
    score += Math.min(candidate.experienceYears, 10) * 2; // up to +20 for experience
    if (candidate.distanceKm !== undefined) {
      // Proximity advantage: fresh nearby candidates receive a score boost up to +20 points.
      // Stale or unavailable candidates have distanceKm === undefined and receive 0 proximity bonus.
      score += Math.max(0, 20 - candidate.distanceKm * 2);
    }
    return Math.round(score * 10) / 10;
  }
}

export class MatchingService {
  private scorer: IMatchingScorer;

  constructor(scorer?: IMatchingScorer) {
    this.scorer = scorer || new DefaultMatchingScorer();
  }

  /**
   * Helper to calculate Haversine distance between two GPS coordinates in kilometers
   */
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Validates if a specific provider satisfies all eligibility rules for a given booking.
   * Server-authoritative check run immediately before dispatch and at offer acceptance.
   */
  async checkEligibility(
    providerId: string,
    bookingId: string,
    options?: { requireFreshLocation?: boolean }
  ): Promise<EligibilityResult> {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        user: true,
        services: true,
        serviceAreas: true,
        bookings: {
          where: {
            currentStatus: {
              in: ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'JOB_STARTED', 'JOB_EXTENDED'],
            },
          },
        },
        dispatchOffers: {
          where: {
            status: 'OFFERED',
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    if (!provider) {
      return { isEligible: false, reason: 'Provider profile does not exist' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        address: true,
        service: true,
        dispatchOffers: {
          where: { providerId },
        },
      },
    });

    if (!booking) {
      return { isEligible: false, reason: 'Booking does not exist' };
    }

    // 1. Account Active
    if (!provider.user || !provider.user.isActive) {
      return { isEligible: false, reason: 'Provider user account is inactive or disabled' };
    }

    // 2. KYC Verified & Not Suspended
    if (provider.verificationStatus === 'SUSPENDED') {
      return { isEligible: false, reason: 'Provider account is suspended' };
    }
    if (provider.verificationStatus !== 'VERIFIED') {
      return { isEligible: false, reason: 'Provider account is not KYC verified' };
    }

    // 3. Online / On-Duty
    if (!provider.isOnline) {
      return { isEligible: false, reason: 'Provider is currently offline' };
    }

    // 4. Offers the requested service
    const offersService = provider.services.some(
      (s) => s.serviceId === booking.serviceId && s.isEnabled
    );
    if (!offersService) {
      return { isEligible: false, reason: 'Provider does not offer the requested service' };
    }

    // 5. Service Area Compatibility
    if (booking.address && provider.serviceAreas.length > 0) {
      const areaMatch = provider.serviceAreas.some((area) => {
        // Direct city match
        if (area.city.toLowerCase() === booking.address.city.toLowerCase()) {
          return true;
        }
        // Radius check if coordinates exist
        if (
          area.centerLatitude &&
          area.centerLongitude &&
          booking.address.latitude &&
          booking.address.longitude
        ) {
          const distKm = this.calculateDistanceKm(
            area.centerLatitude,
            area.centerLongitude,
            booking.address.latitude,
            booking.address.longitude
          );
          return distKm <= area.serviceRadiusMeters / 1000;
        }
        return false;
      });

      if (!areaMatch) {
        return { isEligible: false, reason: 'Booking location is outside provider service area' };
      }
    }

    // 6. Workload / Busy Status: Provider has an ongoing job in transit or active execution
    if (provider.bookings.length > 0) {
      return { isEligible: false, reason: 'Provider is currently busy with an active job' };
    }

    // 7. Active Pending Offer: Provider is currently evaluating another unexpired offer
    const pendingOfferForOtherBooking = provider.dispatchOffers.some(
      (o) => o.bookingId !== booking.id
    );
    if (pendingOfferForOtherBooking) {
      return { isEligible: false, reason: 'Provider is currently evaluating another active offer' };
    }

    // 8. Self-booking protection: Provider cannot accept their own booking
    if (provider.userId === booking.customerId) {
      return { isEligible: false, reason: 'Provider cannot service their own booking' };
    }

    // 9. Rejection history: Provider previously rejected this specific booking
    const previouslyRejected = booking.dispatchOffers.some(
      (o) => o.status === 'REJECTED'
    );
    if (previouslyRejected) {
      return { isEligible: false, reason: 'Provider previously declined this booking' };
    }

    // 10. Location freshness verification (if proximity dispatch requires fresh GPS)
    if (options?.requireFreshLocation) {
      const freshness = locationService.getFreshnessStatus(provider.lastLocationAt);
      if (freshness !== 'FRESH') {
        return { isEligible: false, reason: 'Provider location is stale or unavailable for immediate proximity dispatch' };
      }
    }

    return { isEligible: true };
  }

  /**
   * Finds and ranks all eligible providers for a booking.
   * Applies filtering and replaceable scoring strategy.
   */
  async findEligibleProviders(
    bookingId: string,
    excludedProviderIds: string[] = [],
    options?: { requireFreshLocation?: boolean }
  ): Promise<EligibleCandidate[]> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        address: true,
        service: true,
        dispatchOffers: true,
      },
    });

    if (!booking) {
      return [];
    }

    // Query potential candidates who offer the service, are verified, and online
    const candidates = await prisma.provider.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        isOnline: true,
        user: { isActive: true },
        id: { notIn: excludedProviderIds },
        services: {
          some: {
            serviceId: booking.serviceId,
            isEnabled: true,
          },
        },
      },
      include: {
        user: true,
        services: true,
        serviceAreas: true,
        bookings: {
          where: {
            currentStatus: {
              in: ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'JOB_STARTED', 'JOB_EXTENDED'],
            },
          },
        },
        dispatchOffers: {
          where: {
            status: 'OFFERED',
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    const eligibleList: EligibleCandidate[] = [];

    for (const p of candidates) {
      // 1. Exclude if provider is the customer
      if (p.userId === booking.customerId) continue;

      // 2. Exclude if currently busy with an active job
      if (p.bookings.length > 0) continue;

      // 3. Exclude if evaluating an active offer for another booking
      const hasOtherActiveOffer = p.dispatchOffers.some((o) => o.bookingId !== booking.id);
      if (hasOtherActiveOffer) continue;

      // 4. Exclude if previously rejected this booking
      const alreadyRejected = booking.dispatchOffers.some(
        (o) => o.providerId === p.id && o.status === 'REJECTED'
      );
      if (alreadyRejected) continue;

      // 5. Service Area Compatibility
      if (booking.address && p.serviceAreas.length > 0) {
        const areaMatch = p.serviceAreas.some((area) => {
          if (area.city.toLowerCase() === booking.address.city.toLowerCase()) {
            return true;
          }
          if (
            area.centerLatitude &&
            area.centerLongitude &&
            booking.address.latitude &&
            booking.address.longitude
          ) {
            const distKm = this.calculateDistanceKm(
              area.centerLatitude,
              area.centerLongitude,
              booking.address.latitude,
              booking.address.longitude
            );
            return distKm <= area.serviceRadiusMeters / 1000;
          }
          return false;
        });

        if (!areaMatch) continue;
      }

      // 5b. Freshness check: if options require fresh location, exclude stale/unavailable providers
      const freshness = locationService.getFreshnessStatus(p.lastLocationAt);
      if (options?.requireFreshLocation && freshness !== 'FRESH') {
        continue;
      }

      // Calculate distance ONLY if provider has FRESH coordinates
      let distanceKm: number | undefined;
      if (
        freshness === 'FRESH' &&
        p.currentLatitude !== null &&
        p.currentLongitude !== null &&
        booking.address?.latitude &&
        booking.address?.longitude
      ) {
        distanceKm = this.calculateDistanceKm(
          p.currentLatitude,
          p.currentLongitude,
          booking.address.latitude,
          booking.address.longitude
        );
      }

      const ratingAvg = Number(p.ratingAverage) || 5.0;
      const score = this.scorer.calculateScore({
        distanceKm,
        ratingAverage: ratingAvg,
        ratingCount: p.ratingCount,
        experienceYears: p.experienceYears,
      });

      eligibleList.push({
        providerId: p.id,
        userId: p.userId,
        businessName: p.businessName,
        distanceKm,
        freshnessStatus: freshness,
        ratingAverage: ratingAvg,
        ratingCount: p.ratingCount,
        score,
      });
    }

    // Sort descending by calculated score
    eligibleList.sort((a, b) => b.score - a.score);

    return eligibleList;
  }
}

export const matchingService = new MatchingService();
