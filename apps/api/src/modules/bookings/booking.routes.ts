import { FastifyInstance } from 'fastify';
import { BookingController } from './booking.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

export async function bookingRoutes(fastify: FastifyInstance) {
  const controller = new BookingController();

  // All booking routes require authentication
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', controller.createBooking);
  fastify.get('/customer/my', controller.getCustomerBookings);
  fastify.get('/provider/my', controller.getProviderBookings);
  fastify.get('/:id', controller.getBookingDetails);
  fastify.patch('/:id/status', controller.updateStatus);
  fastify.post('/:id/materials', controller.addMaterial);
  fastify.patch('/:id/materials/approve', controller.approveMaterial);
  fastify.post('/:id/quotes', controller.submitQuote);
}
