import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationService, locationService } from './location.service.js';
import { LocationUpdateSchema } from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError, NotFoundError } from '../../common/errors/app-error.js';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

export class LocationController {
  private service: LocationService;

  constructor(service = locationService) {
    this.service = service;
  }

  /**
   * POST /api/v1/providers/location
   * Secure beacon update for authenticated providers.
   */
  updateLocation = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = LocationUpdateSchema.parse(request.body);
    const result = await this.service.updateProviderLocation(request.user.id, validated);
    return sendSuccess(reply, result, 200);
  };

  /**
   * GET /api/v1/providers/location/status
   * Retrieves provider's own current operational location and freshness status.
   */
  getLocationStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const provider = await prisma.provider.findUnique({
      where: { userId: request.user.id },
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

    const freshnessStatus = this.service.getFreshnessStatus(provider.lastLocationAt);
    const operationalStatus = this.service.getOperationalStatus({
      isOnline: provider.isOnline,
      lastLocationAt: provider.lastLocationAt,
      activeBookingsCount: provider.bookings.length,
    });

    return sendSuccess(
      reply,
      {
        providerId: provider.id,
        latitude: provider.currentLatitude,
        longitude: provider.currentLongitude,
        accuracy: provider.currentAccuracyMeters,
        heading: provider.currentHeading,
        speed: provider.currentSpeed,
        lastLocationAt: provider.lastLocationAt?.toISOString() ?? null,
        freshnessStatus,
        isOnline: provider.isOnline,
        operationalStatus,
      },
      200
    );
  };

  /**
   * GET /api/v1/bookings/:id/provider-location
   * Customer tracking endpoint (enforces lifecycle & ownership authorization).
   */
  getBookingTrackingLocation = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await this.service.getCustomerTrackingLocation(
      request.params.id,
      request.user
    );
    return sendSuccess(reply, result, 200);
  };

  /**
   * POST /api/v1/admin/location/prune
   * Retention policy log pruner for administrators.
   */
  pruneLocationLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const schema = z.object({ retentionDays: z.number().int().min(1).default(30) });
    const { retentionDays } = schema.parse(request.body || {});
    const deletedCount = await this.service.pruneOldLocationLogs(retentionDays, request.user.id);
    return sendSuccess(reply, { deletedCount, retentionDays }, 200);
  };
}

export const locationController = new LocationController();
