import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

export async function authRoutes(fastify: FastifyInstance) {
  const controller = new AuthController();

  // Public Routes
  fastify.post('/otp/send', controller.sendOtp);
  fastify.post('/otp/verify', (req, rep) => controller.verifyOtp(req, rep, fastify));
  fastify.post('/refresh', (req, rep) => controller.refreshToken(req, rep, fastify));
  fastify.post('/logout', controller.logout);

  // Protected Routes
  fastify.get('/me', { preHandler: [authenticate] }, controller.getMe);
  fastify.put('/profile', { preHandler: [authenticate] }, controller.updateProfile);
}
