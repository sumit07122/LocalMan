import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireRoles } from '../../common/middleware/rbac.middleware.js';

export async function adminRoutes(fastify: FastifyInstance) {
  const controller = new AdminController();

  // All admin routes require authentication and an administrative role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook(
    'preHandler',
    requireRoles(['ADMIN', 'CITY_MANAGER', 'KYC_VERIFIER', 'FINANCE_MANAGER'])
  );

  fastify.get('/metrics', controller.getMetrics);
  fastify.get('/kyc/pending', controller.getPendingKycDocuments);
  fastify.post('/kyc/review', controller.reviewKycDocument);
  fastify.get('/audit-logs', controller.getAuditLogs);
}
