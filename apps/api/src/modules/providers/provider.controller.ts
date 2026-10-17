import { FastifyRequest, FastifyReply } from 'fastify';
import { ProviderService } from './provider.service.js';
import {
  UpdateProviderProfileSchema,
  SubmitKycDocumentSchema,
  SetAvailabilitySchema,
  UpdateLocationBeaconSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';
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

  toggleOnline = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const schema = z.object({ isOnline: z.boolean() });
    const { isOnline } = schema.parse(request.body);
    const result = await this.providerService.toggleOnline(request.user.id, isOnline);
    return sendSuccess(reply, result, 200);
  };
}
