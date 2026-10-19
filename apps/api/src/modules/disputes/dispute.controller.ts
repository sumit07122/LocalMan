import { FastifyRequest, FastifyReply } from 'fastify';
import { disputeService } from './dispute.service.js';
import { CreateDisputeSchema, ResolveDisputeSchema } from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';

export class DisputeController {
  /**
   * POST /api/v1/bookings/:bookingId/disputes
   */
  async openDispute(
    request: FastifyRequest<{ Params: { id?: string; bookingId?: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const body = (request.body as Record<string, any>) || {};
    const bookingId = request.params.bookingId || request.params.id || body.bookingId || '';
    const rawInput = { ...body, bookingId };
    const input = CreateDisputeSchema.parse(rawInput);
    const user = request.user as AuthenticatedUser;

    const result = await disputeService.openDispute(user, input);
    return reply.status(201).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/bookings/:bookingId/disputes
   */
  async getDisputesForBooking(
    request: FastifyRequest<{ Params: { id?: string; bookingId?: string } }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const user = request.user as AuthenticatedUser;

    const result = await disputeService.getDisputesForBooking(user, bookingId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/disputes/:id
   */
  async getDisputeById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = request.user as AuthenticatedUser;
    const result = await disputeService.getDisputeById(user, request.params.id);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/admin/disputes
   */
  async listAdminDisputes(
    request: FastifyRequest<{ Querystring: { status?: string; page?: string; limit?: string } }>,
    reply: FastifyReply
  ) {
    const { status, page, limit } = request.query;
    const result = await disputeService.listAdminDisputes({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/admin/disputes/:id/resolve
   */
  async resolveDispute(
    request: FastifyRequest<{ Params: { id: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const input = ResolveDisputeSchema.parse(request.body || {});
    const adminUser = request.user as AuthenticatedUser;

    const result = await disputeService.resolveDispute(adminUser, request.params.id, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}

export const disputeController = new DisputeController();
