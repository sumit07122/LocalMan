import { FastifyRequest, FastifyReply } from 'fastify';
import { ProviderService } from './provider.service.js';
import {
  UpdateProviderProfileSchema,
  SubmitKycDocumentSchema,
  SetAvailabilitySchema,
  UpdateLocationBeaconSchema,
  UpdateJobStatusSchema,
  AddBookingMaterialSchema,
  RequestPayoutSchema,
  QueryLedgerSchema,
  QueryDispatchOffersSchema,
  StartJobSchema,
  CompleteJobSchema,
  TravelStatusSchema,
  ArrivedStatusSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError, ForbiddenError } from '../../common/errors/app-error.js';
import { realtimeService } from '../realtime/realtime.service.js';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

export class ProviderController {
  private providerService = new ProviderService();

  getProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const profile = await this.providerService.getProfile(request.user.id);
    return sendSuccess(reply, profile, 200);
  };

  updateProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = UpdateProviderProfileSchema.parse(request.body);
    const updated = await this.providerService.updateProfile(request.user.id, validated);
    return sendSuccess(reply, updated, 200);
  };

  submitKycDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = SubmitKycDocumentSchema.parse(request.body);
    const doc = await this.providerService.submitKycDocument(request.user.id, validated);
    return sendSuccess(reply, doc, 201);
  };

  setAvailability = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = SetAvailabilitySchema.parse(request.body);
    const result = await this.providerService.setAvailability(request.user.id, validated);
    return sendSuccess(reply, result, 200);
  };

  updateLocation = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = UpdateLocationBeaconSchema.parse(request.body);
    const result = await this.providerService.updateLocation(request.user.id, validated);
    return sendSuccess(reply, result, 200);
  };

  getLocationStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await this.providerService.getLocationStatus(request.user.id);
    return sendSuccess(reply, result, 200);
  };

  toggleOnline = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const schema = z.object({ isOnline: z.boolean() });
    const { isOnline } = schema.parse(request.body);
    const result = await this.providerService.toggleOnline(request.user.id, isOnline);
    return sendSuccess(reply, result, 200);
  };

  getProviderBookings = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const bookings = await this.providerService.getProviderBookings(request.user.id);
    return sendSuccess(reply, bookings, 200);
  };

  getProviderBookingDetails = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const isAdmin = request.user.roles.includes('ADMIN') || request.user.roles.includes('CITY_MANAGER');
    const booking = await this.providerService.getProviderBookingDetails(
      request.user.id,
      request.params.id,
      isAdmin
    );
    return sendSuccess(reply, booking, 200);
  };

  acceptBooking = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const isAdmin = request.user.roles.includes('ADMIN') || request.user.roles.includes('CITY_MANAGER');
    const updated = await this.providerService.acceptBooking(
      request.user.id,
      request.params.id,
      isAdmin
    );
    return sendSuccess(reply, updated, 200);
  };

  rejectBooking = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const isAdmin = request.user.roles.includes('ADMIN') || request.user.roles.includes('CITY_MANAGER');
    const body = (request.body as { reason?: string } | undefined);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : undefined;
    const updated = await this.providerService.rejectBooking(
      request.user.id,
      request.params.id,
      isAdmin,
      reason
    );
    return sendSuccess(reply, updated, 200);
  };

  // ---------------------------------------------------------------------------
  // Phase 2C: Job Execution & Wallet
  // ---------------------------------------------------------------------------

  /**
   * PATCH /providers/bookings/:id/job-status
   * Provider updates live job state (ON_THE_WAY → ARRIVED → JOB_STARTED → JOB_COMPLETED).
   * Identity is always derived from the JWT — client body is never trusted for actorId, providerId,
   * or any financial field. FSM is enforced server-side, including OTP verification for JOB_STARTED.
   */
  updateJobStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = UpdateJobStatusSchema.parse(request.body);
    const updated = await this.providerService.updateJobStatus(
      request.user.id,
      request.params.id,
      validated
    );
    return sendSuccess(reply, updated, 200);
  };

  /**
   * POST /providers/bookings/:id/on-the-way
   * Provider starts travel to customer location.
   */
  startTravel = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const body = (request.body && typeof request.body === 'object' ? request.body : {}) as any;
    const validated = TravelStatusSchema.parse(body);
    const updated = await this.providerService.startTravel(
      request.user.id,
      request.params.id,
      validated.reason
    );
    return sendSuccess(reply, updated, 200);
  };

  /**
   * POST /providers/bookings/:id/arrived
   * Provider marks arrival at customer service location.
   */
  markArrived = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const body = (request.body && typeof request.body === 'object' ? request.body : {}) as any;
    const validated = ArrivedStatusSchema.parse(body);
    const updated = await this.providerService.markArrived(
      request.user.id,
      request.params.id,
      validated.reason
    );
    return sendSuccess(reply, updated, 200);
  };

  /**
   * POST /providers/bookings/:id/start
   * Provider verifies Customer Start OTP and initiates job execution.
   */
  startJob = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = StartJobSchema.parse(request.body);
    const updated = await this.providerService.startJob(
      request.user.id,
      request.params.id,
      validated
    );
    return sendSuccess(reply, updated, 200);
  };

  /**
   * POST /providers/bookings/:id/complete
   * Provider marks job execution completed.
   */
  completeJob = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const body = (request.body && typeof request.body === 'object' ? request.body : {}) as any;
    const validated = CompleteJobSchema.parse(body);
    const updated = await this.providerService.completeJob(
      request.user.id,
      request.params.id,
      validated.reason
    );
    return sendSuccess(reply, updated, 200);
  };

  /**
   * GET /providers/wallet
   * Returns read-only backend-authoritative wallet summary and itemized payout ledger.
   * No financial values are ever accepted from the client for this endpoint.
   */
  getProviderWallet = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const wallet = await this.providerService.getProviderWallet(request.user.id);
    return sendSuccess(reply, wallet, 200);
  };

  /**
   * POST /providers/bookings/:id/materials
   * Provider adds extra spare parts / materials to an active job.
   */
  addMaterial = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = AddBookingMaterialSchema.parse(request.body);
    const material = await this.providerService.addMaterial(
      request.user.id,
      request.params.id,
      validated
    );
    return sendSuccess(reply, material, 201);
  };

  /**
   * POST /providers/wallet/payouts
   * Provider requests withdrawal of available balance.
   */
  requestPayout = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = RequestPayoutSchema.parse(request.body || {});
    const idempotencyKey = (request.headers['idempotency-key'] as string | undefined) ||
      (request.body as any)?.idempotencyKey;
    const payout = await this.providerService.requestPayout(
      request.user.id,
      validated,
      idempotencyKey
    );
    return sendSuccess(reply, payout, 201);
  };

  /**
   * GET /providers/wallet/ledger
   * Provider inspects full paginated ledger entries.
   */
  getProviderLedger = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = QueryLedgerSchema.parse(request.query || {});
    const ledger = await this.providerService.getProviderLedger(request.user.id, validated);
    return sendSuccess(reply, ledger, 200);
  };

  /**
   * GET /providers/dispatch/offers/active
   * Fetch currently active unexpired offer awaiting provider response
   */
  getActiveDispatchOffer = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const offer = await this.providerService.getActiveDispatchOffer(request.user.id);
    return sendSuccess(reply, offer, 200);
  };

  /**
   * GET /providers/dispatch/offers
   * Fetch paginated list of dispatch offers for provider
   */
  getDispatchOffers = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = QueryDispatchOffersSchema.parse(request.query || {});
    const offers = await this.providerService.getDispatchOffers(request.user.id, validated);
    return sendSuccess(reply, offers, 200);
  };

  /**
   * POST /providers/dispatch/offers/:id/accept
   * Atomically accept a dispatch offer
   */
  acceptDispatchOffer = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await this.providerService.acceptDispatchOffer(
      request.user.id,
      request.params.id
    );
    return sendSuccess(reply, result, 200);
  };

  /**
   * POST /providers/dispatch/offers/:id/reject
   * Reject a dispatch offer and trigger redispatch
   */
  rejectDispatchOffer = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const body = (request.body as any) || {};
    const reason = body.reason || body.rejectionReason;
    const result = await this.providerService.rejectDispatchOffer(
      request.user.id,
      request.params.id,
      reason
    );
    return sendSuccess(reply, result, 200);
  };

  /**
   * GET /providers/dispatch/stream
   * Real-time Server-Sent Events (SSE) stream for dispatch events
   */
  subscribeDispatchStream = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const provider = await prisma.provider.findUnique({
      where: { userId: request.user.id },
    });
    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({ status: 'connected', providerId: provider.id })}\n\n`
    );

    const unsubscribe = realtimeService.subscribe(`provider:${provider.id}`, (event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    });

    request.raw.on('close', () => {
      unsubscribe();
    });
  };
}

