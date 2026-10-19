import { FastifyRequest, FastifyReply } from 'fastify';
import { cancellationService } from './cancellation.service.js';
import { CancelBookingSchema, RecordNoShowSchema } from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';

export class CancellationController {
  /**
   * POST /api/v1/bookings/:bookingId/cancel
   */
  async cancelCustomerBooking(
    request: FastifyRequest<{ Params: { id?: string; bookingId?: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = CancelBookingSchema.parse(request.body || {});
    const customer = request.user as AuthenticatedUser;

    const result = await cancellationService.cancelCustomerBooking(customer, bookingId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/providers/bookings/:id/cancel
   */
  async cancelProviderBooking(
    request: FastifyRequest<{ Params: { id?: string; bookingId?: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = CancelBookingSchema.parse(request.body || {});
    const providerUser = request.user as AuthenticatedUser;

    const result = await cancellationService.cancelProviderBooking(providerUser, bookingId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/bookings/:id/no-show and POST /api/v1/providers/bookings/:id/no-show
   */
  async recordNoShow(
    request: FastifyRequest<{ Params: { id?: string; bookingId?: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = RecordNoShowSchema.parse(request.body || {});
    const actor = request.user as AuthenticatedUser;

    const result = await cancellationService.recordNoShow(actor, bookingId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}

export const cancellationController = new CancellationController();
