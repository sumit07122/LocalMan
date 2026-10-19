import { FastifyRequest, FastifyReply } from 'fastify';
import { chatService } from './chat.service.js';
import {
  SendMessageSchema,
  ListMessagesQuerySchema,
  MarkReadSchema,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class ChatController {
  /**
   * GET /api/v1/bookings/:bookingId/messages/conversation
   * Retrieve or initialize conversation metadata
   */
  async getConversation(
    request: FastifyRequest<{ Params: { bookingId?: string; id?: string } }>,
    reply: FastifyReply
  ) {
    if (!request.user) throw new UnauthorizedError();
    const bookingId = request.params.bookingId || request.params.id || '';
    const user = request.user as AuthenticatedUser;

    const result = await chatService.getOrCreateConversation(user, bookingId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/bookings/:bookingId/messages
   * List paginated conversation messages in deterministic chronological order
   */
  async listMessages(
    request: FastifyRequest<{
      Params: { bookingId?: string; id?: string };
      Querystring: any;
    }>,
    reply: FastifyReply
  ) {
    if (!request.user) throw new UnauthorizedError();
    const bookingId = request.params.bookingId || request.params.id || '';
    const query = ListMessagesQuerySchema.parse(request.query || {});
    const user = request.user as AuthenticatedUser;

    const result = await chatService.listMessages(user, bookingId, query);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/bookings/:bookingId/messages
   * Send a new message with server-authoritative sender and idempotency
   */
  async sendMessage(
    request: FastifyRequest<{
      Params: { bookingId?: string; id?: string };
      Body: any;
    }>,
    reply: FastifyReply
  ) {
    if (!request.user) throw new UnauthorizedError();
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = SendMessageSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await chatService.sendMessage(user, bookingId, input);
    return reply.status(201).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * POST /api/v1/bookings/:bookingId/messages/read
   * Mark messages as read by current participant
   */
  async markRead(
    request: FastifyRequest<{
      Params: { bookingId?: string; id?: string };
      Body: any;
    }>,
    reply: FastifyReply
  ) {
    if (!request.user) throw new UnauthorizedError();
    const bookingId = request.params.bookingId || request.params.id || '';
    const input = MarkReadSchema.parse(request.body || {});
    const user = request.user as AuthenticatedUser;

    const result = await chatService.markConversationRead(user, bookingId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * GET /api/v1/bookings/:bookingId/messages/stream
   * Authorized Server-Sent Events (SSE) stream for booking chat
   */
  async subscribeStream(
    request: FastifyRequest<{ Params: { bookingId?: string; id?: string } }>,
    reply: FastifyReply
  ) {
    if (!request.user) throw new UnauthorizedError();
    const bookingId = request.params.bookingId || request.params.id || '';
    const user = request.user as AuthenticatedUser;

    // Validate participant authorization before opening connection
    await chatService.getOrCreateConversation(user, bookingId);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({ status: 'connected', bookingId })}\n\n`
    );

    const unsubscribe = realtimeService.subscribe(`booking:${bookingId}:messages`, (event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    });

    request.raw.on('close', () => {
      unsubscribe();
    });
  }

  /**
   * GET /api/v1/admin/bookings/:bookingId/messages
   * Authorized admin inspection of booking conversation
   */
  async adminGetMessages(
    request: FastifyRequest<{
      Params: { bookingId?: string; id?: string };
      Querystring: any;
    }>,
    reply: FastifyReply
  ) {
    if (!request.user) throw new UnauthorizedError();
    const bookingId = request.params.bookingId || request.params.id || '';
    const query = ListMessagesQuerySchema.parse(request.query || {});
    const user = request.user as AuthenticatedUser;

    const result = await chatService.getConversationForAdmin(user, bookingId, query);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}

export const chatController = new ChatController();
