import { FastifyRequest, FastifyReply } from 'fastify';
import { quoteService } from './quote.service.js';
import {
  SubmitQuoteSchema,
  UpdateQuoteSchema,
  AcceptQuoteSchema,
  RejectQuoteSchema,
  WithdrawQuoteSchema,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';

export class QuoteController {
  /**
   * POST /api/v1/providers/bookings/:bookingId/quotes
   */
  async submitQuote(
    request: FastifyRequest<{ Params: { bookingId?: string; id?: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = SubmitQuoteSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.submitQuote(user, bookingId, input);
    return reply.status(201).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * PATCH /api/v1/providers/quotes/:quoteId
   */
  async updateQuote(
    request: FastifyRequest<{ Params: { quoteId: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const input = UpdateQuoteSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.updateQuote(user, request.params.quoteId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/providers/quotes/:quoteId/withdraw
   */
  async withdrawQuote(
    request: FastifyRequest<{ Params: { quoteId: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const input = WithdrawQuoteSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.withdrawQuote(user, request.params.quoteId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/bookings/:bookingId/quotes
   */
  async getQuotesForBooking(
    request: FastifyRequest<{ Params: { bookingId?: string; id?: string } }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.getQuotesForBooking(user, bookingId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/bookings/:bookingId/quotes/:quoteId OR GET /api/v1/quotes/:quoteId
   */
  async getQuoteById(
    request: FastifyRequest<{ Params: { quoteId?: string; id?: string } }>,
    reply: FastifyReply
  ) {
    const quoteId = request.params.quoteId || request.params.id || '';
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.getQuoteById(user, quoteId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/bookings/:bookingId/quotes/:quoteId/accept
   */
  async acceptQuote(
    request: FastifyRequest<{ Params: { bookingId?: string; id?: string; quoteId: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = AcceptQuoteSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.acceptQuote(user, bookingId, request.params.quoteId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/bookings/:bookingId/quotes/:quoteId/reject
   */
  async rejectQuote(
    request: FastifyRequest<{ Params: { bookingId?: string; id?: string; quoteId: string }; Body: any }>,
    reply: FastifyReply
  ) {
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = RejectQuoteSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await quoteService.rejectQuote(user, bookingId, request.params.quoteId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/admin/quotes/expire-stale
   */
  async expireStaleQuotes(
    _request: FastifyRequest,
    reply: FastifyReply
  ) {
    const result = await quoteService.expireStaleQuotes();
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}

export const quoteController = new QuoteController();
