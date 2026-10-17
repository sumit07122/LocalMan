import { FastifyInstance } from 'fastify';
import { CatalogController } from './catalog.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireRoles } from '../../common/middleware/rbac.middleware.js';

export async function catalogRoutes(fastify: FastifyInstance) {
  const controller = new CatalogController();

  // Public Discovery
  fastify.get('/categories', controller.getCategories);
  fastify.get('/services', controller.searchServices);
  fastify.get('/services/:id', controller.getServiceById);

  // Admin Management
  fastify.post(
    '/categories',
    { preHandler: [authenticate, requireRoles(['ADMIN', 'CITY_MANAGER'])] },
    controller.createCategory
  );
  fastify.post(
    '/services',
    { preHandler: [authenticate, requireRoles(['ADMIN', 'CITY_MANAGER'])] },
    controller.createService
  );
}
