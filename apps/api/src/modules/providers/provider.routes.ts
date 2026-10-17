import { FastifyInstance } from 'fastify';
import { ProviderController } from './provider.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireRoles } from '../../common/middleware/rbac.middleware.js';

export async function providerRoutes(fastify: FastifyInstance) {
  const controller = new ProviderController();

  // All provider endpoints require authentication + PROVIDER or ADMIN role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRoles(['PROVIDER', 'ADMIN']));

  fastify.get('/profile', controller.getProfile);
  fastify.put('/profile', controller.updateProfile);
  fastify.post('/kyc/document', controller.submitKycDocument);
  fastify.put('/availability', controller.setAvailability);
  fastify.post('/location/beacon', controller.updateLocation);
  fastify.post('/toggle-online', controller.toggleOnline);
}
