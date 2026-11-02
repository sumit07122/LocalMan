import { FastifyRequest, FastifyReply } from 'fastify';
import { BookingService } from './booking.service.js';
import {
  CreateBookingSchema,
  UpdateBookingStatusSchema,
  AddBookingMaterialSchema,
  ApproveBookingMaterialSchema,
  SubmitQuoteSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { locationService } from '../location/location.service.js';
import { prisma } from '../../config/database.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class BookingController {
  private bookingService = new BookingService();

  createBooking = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = CreateBookingSchema.parse(request.body);
    const idempotencyKey =
      (request.headers['idempotency-key'] as string) ||
      (request.body as any)?.idempotencyKey ||
      validated.idempotencyKey;
    const booking = await this.bookingService.createBooking(request.user, {
      ...validated,
      idempotencyKey,
    });
    return sendSuccess(reply, booking, 201);
  };

  listBookings = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const query = (request.query as any) || {};
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const status = query.status as string | undefined;
    const result = await this.bookingService.listBookings(request.user, { page, limit, status });
    return sendSuccess(reply, result, 200);
  };

  updateStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = UpdateBookingStatusSchema.parse(request.body);
    const updated = await this.bookingService.updateStatus(
      request.params.id,
      request.user,
      validated
    );
    return sendSuccess(reply, updated, 200);
  };

  addMaterial = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = AddBookingMaterialSchema.parse(request.body);
    const material = await this.bookingService.addMaterial(
      request.params.id,
      request.user,
      validated
    );
    return sendSuccess(reply, material, 201);
  };

  approveMaterial = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = ApproveBookingMaterialSchema.parse(request.body);
    const result = await this.bookingService.approveMaterial(
      request.params.id,
      validated.materialId,
      request.user,
      validated.approved
    );
    return sendSuccess(reply, result, 200);
  };

  submitQuote = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = SubmitQuoteSchema.parse(request.body);
    const quote = await this.bookingService.submitQuote(
      request.params.id,
      request.user,
      validated
    );
    return sendSuccess(reply, quote, 201);
  };

  getBookingDetails = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const booking = await this.bookingService.getBookingDetails(request.params.id, request.user);
    return sendSuccess(reply, booking, 200);
  };

  getCustomerBookings = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const bookings = await this.bookingService.getCustomerBookings(request.user.id);
    return sendSuccess(reply, bookings, 200);
  };

  getProviderBookings = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const bookings = await this.bookingService.getProviderBookings(request.user.id);
    return sendSuccess(reply, bookings, 200);
  };

  triggerDispatch = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await this.bookingService.triggerDispatch(request.params.id);
    return sendSuccess(
      reply,
      result || { message: 'No eligible providers available for dispatch' },
      result ? 201 : 200
    );
  };

  getDispatchStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const status = await this.bookingService.getDispatchStatus(request.params.id);
    return sendSuccess(reply, status, 200);
  };

  getProviderLocation = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await locationService.getCustomerTrackingLocation(
      request.params.id,
      request.user
    );
    return sendSuccess(reply, result, 200);
  };

  getBookingMapState = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await locationService.getBookingMapState(
      request.params.id,
      request.user
    );
    return sendSuccess(reply, result, 200);
  };

  getBookingEta = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await locationService.getBookingEta(
      request.params.id,
      request.user
    );
    return sendSuccess(reply, result, 200);
  };

  /**
   * GET /bookings/:id/stream
   * Real-time Server-Sent Events (SSE) stream for booking lifecycle events
   */
  subscribeBookingStream = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const booking = await prisma.booking.findUnique({
      where: { id: request.params.id },
      include: { provider: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === request.user.id;
    const isAssignedProvider = booking.provider?.userId === request.user.id;
    const isAdmin =
      request.user.roles.includes('ADMIN') || request.user.roles.includes('CITY_MANAGER');

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError('Access denied: You cannot subscribe to events for this booking.');
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({ status: 'connected', bookingId: booking.id })}\n\n`
    );

    const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    });

    request.raw.on('close', () => {
      unsubscribe();
    });
  };
}
