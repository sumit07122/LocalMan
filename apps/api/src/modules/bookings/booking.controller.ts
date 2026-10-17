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
import { UnauthorizedError } from '../../common/errors/app-error.js';

export class BookingController {
  private bookingService = new BookingService();

  createBooking = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = CreateBookingSchema.parse(request.body);
    const booking = await this.bookingService.createBooking(request.user, validated);
    return sendSuccess(reply, booking, 201);
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
}
