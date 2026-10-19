import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import {
  LocationUpdateInput,
  ProviderLocationResponse,
  CustomerTrackingLocationResponse,
  LocationFreshnessStatus,
  ProviderOperationalStatus,
} from '@localman/contracts';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  TooManyRequestsError,
} from '../../common/errors/app-error.js';
import { googleMapsService } from './google-maps.service.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class LocationService {
  private freshnessThresholdMs: number;
  private throttleWindowMs: number;
  private lastUpdateTimestamps = new Map<string, number>();

  constructor() {
    this.freshnessThresholdMs = (env.LOCATION_FRESHNESS_THRESHOLD_SECONDS || 900) * 1000;
    this.throttleWindowMs = (env.LOCATION_THROTTLE_SECONDS || 5) * 1000;
  }

  /**
   * Resets in-memory throttle cache (used primarily for test isolation).
   */
  public clearThrottleCache(): void {
    this.lastUpdateTimestamps.clear();
  }

  /**
   * Evaluates freshness of a given location timestamp.
   * If timestamp is in the future (> 15s) or missing, classifies as UNAVAILABLE.
   */
  public getFreshnessStatus(lastLocationAt: Date | null | undefined): LocationFreshnessStatus {
    if (!lastLocationAt) {
      return 'UNAVAILABLE';
    }
    const time = new Date(lastLocationAt).getTime();
    if (isNaN(time)) {
      return 'UNAVAILABLE';
    }
    const ageMs = Date.now() - time;
    // Clock drift or future timestamp: if more than 15s into future, reject as UNAVAILABLE
    if (ageMs < -15000) {
      return 'UNAVAILABLE';
    }
    if (ageMs > this.freshnessThresholdMs) {
      return 'STALE';
    }
    return 'FRESH';
  }

  /**
   * Calculates operational status from provider state.
   */
  public getOperationalStatus(provider: {
    isOnline: boolean;
    lastLocationAt: Date | null | undefined;
    activeBookingsCount?: number;
  }): ProviderOperationalStatus {
    if (!provider.isOnline) {
      return 'OFFLINE';
    }
    if ((provider.activeBookingsCount ?? 0) > 0) {
      return 'BUSY';
    }
    const freshness = this.getFreshnessStatus(provider.lastLocationAt);
    if (freshness === 'STALE' || freshness === 'UNAVAILABLE') {
      return 'ONLINE_BUT_LOCATION_STALE';
    }
    return 'ONLINE';
  }

  /**
   * Secure provider location beacon update.
   */
  async updateProviderLocation(
    userId: string,
    input: LocationUpdateInput
  ): Promise<ProviderLocationResponse> {
    const provider = await prisma.provider.findUnique({
      where: { userId },
      include: {
        bookings: {
          where: {
            currentStatus: {
              in: ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'JOB_STARTED', 'JOB_EXTENDED'],
            },
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    // 1. Rate limiting / Throttling (multi-instance DB backed + in-memory debounce)
    const now = Date.now();
    const inMemLast = this.lastUpdateTimestamps.get(provider.id);
    const dbLast = provider.lastLocationAt ? new Date(provider.lastLocationAt).getTime() : 0;
    const effectiveLast = Math.max(inMemLast || 0, dbLast);

    if (effectiveLast > 0 && now - effectiveLast < this.throttleWindowMs) {
      const waitSeconds = Math.max(1, Math.ceil((this.throttleWindowMs - (now - effectiveLast)) / 1000));
      throw new TooManyRequestsError(
        `Location update throttled. Please wait ${waitSeconds}s before sending another update.`
      );
    }

    // 2. Strict Sanity Checks on Coordinates, Accuracy, Speed, Heading
    if (isNaN(input.latitude) || input.latitude < -90 || input.latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90 degrees.');
    }
    if (isNaN(input.longitude) || input.longitude < -180 || input.longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180 degrees.');
    }
    if (input.accuracy !== undefined && (isNaN(input.accuracy) || input.accuracy <= 0 || input.accuracy > 5000)) {
      throw new ValidationError('Accuracy must be greater than 0 and at most 5000 meters.');
    }
    if (input.speed !== undefined && (isNaN(input.speed) || input.speed < 0 || input.speed > 75)) {
      throw new ValidationError('Speed must be between 0 and 75 m/s (~270 km/h).');
    }
    if (input.heading !== undefined && (isNaN(input.heading) || input.heading < 0 || input.heading > 360)) {
      throw new ValidationError('Heading must be between 0 and 360 degrees.');
    }

    // 3. Timestamp Sanity & Safe Server Authority
    let clientTimestamp: Date | null = null;
    if (input.timestamp !== undefined) {
      const clientTime =
        typeof input.timestamp === 'number'
          ? input.timestamp
          : new Date(input.timestamp).getTime();

      if (isNaN(clientTime)) {
        throw new ValidationError('Invalid timestamp format provided.');
      }
      if (clientTime - now > 15000) {
        throw new ValidationError('Location timestamp cannot be in the future.');
      }
      if (now - clientTime > 86400000) {
        throw new ValidationError('Location timestamp is too old (> 24 hours).');
      }
      clientTimestamp = new Date(clientTime);
    }

    const serverTimestamp = new Date();
    const logTimestamp = clientTimestamp || serverTimestamp;

    // Check for out-of-order beacon arrival:
    // If client beacon is older than currently persisted lastLocationAt, do NOT overwrite current active position
    const isOutOfOrder =
      clientTimestamp !== null &&
      Boolean(provider.lastLocationAt) &&
      clientTimestamp.getTime() < (provider.lastLocationAt as Date).getTime();

    // 4. Movement / Speed jump sanity check (detect impossible displacements)
    if (
      !isOutOfOrder &&
      provider.currentLatitude !== null &&
      provider.currentLongitude !== null &&
      provider.lastLocationAt != null
    ) {
      const prevLat = provider.currentLatitude;
      const prevLon = provider.currentLongitude;
      const prevTime = new Date(provider.lastLocationAt).getTime();
      const elapsedSeconds = Math.max(0.001, (now - prevTime) / 1000);

      if (elapsedSeconds < 3600) {
        const displacementMeters = googleMapsService.calculateHaversineDistanceMeters(
          prevLat,
          prevLon,
          input.latitude,
          input.longitude
        );
        const impliedSpeedMps = displacementMeters / elapsedSeconds;
        // 80 m/s is ~288 km/h. Exceeding this over short intervals indicates spoofing or bad coordinates.
        if (impliedSpeedMps > 80 && displacementMeters > 500) {
          throw new ValidationError(
            'Excessive displacement detected. Implied travel speed exceeds physical limits.'
          );
        }
      }
    }

    // 5. Persist to PostgreSQL
    let updatedProvider: {
      id: string;
      isOnline: boolean;
      currentLatitude: number | null;
      currentLongitude: number | null;
      currentAccuracyMeters: number | null;
      currentHeading: number | null;
      currentSpeed: number | null;
      lastLocationAt: Date | null;
    } = provider;
    if (isOutOfOrder) {
      // Historical log only; active provider coordinates remain untouched
      await prisma.providerLocationLog.create({
        data: {
          providerId: provider.id,
          bookingId: input.bookingId ?? null,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy ?? null,
          heading: input.heading ?? null,
          speed: input.speed ?? null,
          source: input.source || 'FOREGROUND_APP',
          createdAt: logTimestamp,
        },
      });
    } else {
      const [upd] = await prisma.$transaction([
        prisma.provider.update({
          where: { id: provider.id },
          data: {
            currentLatitude: input.latitude,
            currentLongitude: input.longitude,
            lastLocationAt: serverTimestamp,
            currentAccuracyMeters: input.accuracy ?? null,
            currentHeading: input.heading ?? null,
            currentSpeed: input.speed ?? null,
          },
        }),
        prisma.providerLocationLog.create({
          data: {
            providerId: provider.id,
            bookingId: input.bookingId ?? null,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy ?? null,
            heading: input.heading ?? null,
            speed: input.speed ?? null,
            source: input.source || 'FOREGROUND_APP',
            createdAt: logTimestamp,
          },
        }),
      ]);
      updatedProvider = upd;
      this.lastUpdateTimestamps.set(provider.id, now);
    }

    const freshnessStatus = this.getFreshnessStatus(updatedProvider.lastLocationAt);
    const operationalStatus = this.getOperationalStatus({
      isOnline: updatedProvider.isOnline,
      lastLocationAt: updatedProvider.lastLocationAt,
      activeBookingsCount: provider.bookings.length,
    });

    const responsePayload: ProviderLocationResponse = {
      providerId: updatedProvider.id,
      latitude: updatedProvider.currentLatitude!,
      longitude: updatedProvider.currentLongitude!,
      accuracy: updatedProvider.currentAccuracyMeters,
      heading: updatedProvider.currentHeading,
      speed: updatedProvider.currentSpeed,
      lastLocationAt: updatedProvider.lastLocationAt?.toISOString() ?? null,
      freshnessStatus,
      isOnline: updatedProvider.isOnline,
      operationalStatus,
    };

    // 6. Real-time broadcast
    realtimeService.emitToProvider(provider.id, 'PROVIDER_LOCATION_UPDATED', responsePayload);

    // Only emit to booking channel if booking is actively trackable (PROVIDER_ON_THE_WAY or ARRIVED)
    const activeTransitBooking = provider.bookings.find(
      (b) =>
        (b.id === input.bookingId || !input.bookingId) &&
        (b.currentStatus === 'PROVIDER_ON_THE_WAY' || b.currentStatus === 'ARRIVED')
    );

    if (activeTransitBooking) {
      realtimeService.emitToBooking(activeTransitBooking.id, 'PROVIDER_LOCATION_UPDATED', {
        bookingId: activeTransitBooking.id,
        latitude: responsePayload.latitude,
        longitude: responsePayload.longitude,
        heading: responsePayload.heading,
        lastLocationAt: responsePayload.lastLocationAt,
        freshnessStatus: responsePayload.freshnessStatus,
      });
    }

    return responsePayload;
  }

  /**
   * Secure customer tracking endpoint for an active booking.
   * Access is strictly restricted to:
   * 1. The customer who booked the service, or Admin/City Manager.
   * 2. Booking lifecycle MUST be in 'PROVIDER_ON_THE_WAY' or 'ARRIVED'.
   */
  async getCustomerTrackingLocation(
    bookingId: string,
    requestUser: { id: string; roles: string[] }
  ): Promise<CustomerTrackingLocationResponse> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        address: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === requestUser.id;
    const isAdmin =
      requestUser.roles.includes('ADMIN') || requestUser.roles.includes('CITY_MANAGER');

    if (!isCustomer && !isAdmin) {
      throw new ForbiddenError('You are not authorized to track location for this booking.');
    }

    // Strict lifecycle constraint: only while provider is on the way or arrived
    const trackableStates = ['PROVIDER_ON_THE_WAY', 'ARRIVED'];
    if (!trackableStates.includes(booking.currentStatus)) {
      throw new ForbiddenError(
        `Live location tracking is only available while provider is en route or at service location. Current status: ${booking.currentStatus}`
      );
    }

    if (!booking.provider) {
      throw new NotFoundError('No provider assigned to this booking.');
    }

    const provider = booking.provider;
    const freshnessStatus = this.getFreshnessStatus(provider.lastLocationAt);

    if (
      provider.currentLatitude === null ||
      provider.currentLongitude === null ||
      provider.lastLocationAt === null ||
      freshnessStatus === 'UNAVAILABLE'
    ) {
      return {
        bookingId: booking.id,
        providerId: provider.id,
        latitude: null,
        longitude: null,
        heading: null,
        lastLocationAt: null,
        freshnessStatus: 'UNAVAILABLE',
        etaMinutes: null,
        distanceMeters: null,
        isRealTimeRouting: false,
      };
    }

    // If location is STALE, do NOT expose old coordinates as current live position
    if (freshnessStatus === 'STALE') {
      return {
        bookingId: booking.id,
        providerId: provider.id,
        latitude: null,
        longitude: null,
        heading: null,
        lastLocationAt: provider.lastLocationAt.toISOString(),
        freshnessStatus: 'STALE',
        etaMinutes: null,
        distanceMeters: null,
        isRealTimeRouting: false,
      };
    }

    // Routing calculation (Google Maps abstraction with safe dev fallback)
    let distanceMeters: number | null = null;
    let etaMinutes: number | null = null;
    let isRealTimeRouting = false;

    if (booking.address?.latitude && booking.address?.longitude) {
      const route = await googleMapsService.calculateRoute(
        { lat: provider.currentLatitude, lng: provider.currentLongitude },
        { lat: booking.address.latitude, lng: booking.address.longitude }
      );
      distanceMeters = route.distanceMeters;
      etaMinutes = route.etaMinutes;
      isRealTimeRouting = route.isRealTimeRouting;
    }

    return {
      bookingId: booking.id,
      providerId: provider.id,
      latitude: provider.currentLatitude,
      longitude: provider.currentLongitude,
      heading: provider.currentHeading,
      lastLocationAt: provider.lastLocationAt.toISOString(),
      freshnessStatus,
      etaMinutes,
      distanceMeters,
      isRealTimeRouting,
    };
  }

  /**
   * Data retention policy: Purges location breadcrumbs older than retentionDays.
   * Audited and idempotent.
   */
  async pruneOldLocationLogs(retentionDays = 30, adminUserId?: string): Promise<number> {
    if (retentionDays < 1) {
      throw new ValidationError('retentionDays must be at least 1 day.');
    }
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.providerLocationLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId: adminUserId || null,
          action: 'PRUNE_LOCATION_LOGS',
          resourceType: 'PROVIDER_LOCATION_LOG',
          resourceId: 'SYSTEM',
          newState: {
            retentionDays,
            deletedCount: result.count,
            cutoffDate: cutoffDate.toISOString(),
          },
        },
      });
    } catch {
      // Audit log table failure must not crash pruning in mock/isolated setups
    }

    return result.count;
  }
}

export const locationService = new LocationService();
