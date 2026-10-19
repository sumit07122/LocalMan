import { FastifyInstance } from 'fastify';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireRoles } from '../../common/middleware/rbac.middleware.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  // Phase 3F Customer Checkout & Verification Endpoints
  fastify.post('/checkout', { preHandler: [authenticate] }, paymentController.createCheckoutSession);
  fastify.post('/verify', { preHandler: [authenticate] }, paymentController.verifyPayment);
  fastify.post('/webhook', paymentController.handleWebhook);
  fastify.get('/summary/:bookingId', { preHandler: [authenticate] }, paymentController.getPaymentSummary);

  // Legacy / Phase 2D compatibility routes
  fastify.post('/orders', { preHandler: [authenticate] }, paymentController.createOrder);
  fastify.post('/confirm', paymentController.confirmPayment);

  // Admin-authorized refunds
  fastify.post(
    '/refunds',
    { preHandler: [authenticate, requireRoles(['ADMIN', 'FINANCE_MANAGER'])] },
    paymentController.processRefund
  );
}
