import { FastifyInstance } from 'fastify';
import { PaymentController } from './payment.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireRoles } from '../../common/middleware/rbac.middleware.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  const controller = new PaymentController();

  // Create order requires authentication (Customer)
  fastify.post('/orders', { preHandler: [authenticate] }, controller.createOrder);

  // Development / Webhook settlement handler
  fastify.post('/confirm', controller.confirmPayment);

  // Refund requires Admin role
  fastify.post(
    '/refunds',
    { preHandler: [authenticate, requireRoles(['ADMIN', 'FINANCE_MANAGER'])] },
    controller.processRefund
  );
}
