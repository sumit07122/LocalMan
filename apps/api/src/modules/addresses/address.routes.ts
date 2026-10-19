import { FastifyInstance } from 'fastify';
import { AddressController } from './address.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

export async function addressRoutes(fastify: FastifyInstance) {
  const controller = new AddressController();

  // All address routes require an authenticated user session
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', controller.list);
  fastify.post('/', controller.create);
  fastify.get('/:id', controller.getById);
  fastify.put('/:id', controller.update);
  fastify.patch('/:id/default', controller.setDefault);
  fastify.delete('/:id', controller.delete);
}
