import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AuthService } from './auth.service.js';
import {
  SendOtpSchema,
  VerifyOtpSchema,
  RefreshTokenSchema,
  UpdateProfileSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';

export class AuthController {
  private authService = new AuthService();

  sendOtp = async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = SendOtpSchema.parse(request.body);
    const result = await this.authService.sendOtp(validated);
    return sendSuccess(reply, result, 200);
  };

  verifyOtp = async (request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) => {
    const validated = VerifyOtpSchema.parse(request.body);
    const result = await this.authService.verifyOtp(fastify, validated);
    return sendSuccess(reply, result, 200);
  };

  refreshToken = async (request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) => {
    const validated = RefreshTokenSchema.parse(request.body);
    const result = await this.authService.refreshToken(fastify, validated.refreshToken);
    return sendSuccess(reply, result, 200);
  };

  getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const result = await this.authService.getCurrentUser(request.user.id);
    return sendSuccess(reply, result, 200);
  };

  updateProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const validated = UpdateProfileSchema.parse(request.body);
    const result = await this.authService.updateProfile(request.user.id, validated);
    return sendSuccess(reply, result, 200);
  };
}
