import { FastifyInstance } from 'fastify';
import { reviewController } from './review.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireRoles } from '../../common/middleware/rbac.middleware.js';

export async function reviewRoutes(fastify: FastifyInstance) {
  // Public provider reviews and reputation
  fastify.get('/providers/:providerId', reviewController.getProviderReviews);
  fastify.get('/providers/:providerId/reviews', reviewController.getProviderReviews);
  fastify.get('/providers/:providerId/reputation', reviewController.getProviderReputation);

  // Authenticated endpoints
  fastify.get('/provider/me', { preHandler: [authenticate, requireRoles(['PROVIDER', 'ADMIN'])] }, reviewController.getMyProviderReviews);

  // Direct review ID endpoints
  fastify.get('/:reviewId', { preHandler: authenticate }, reviewController.getReviewById);
  fastify.put('/:reviewId', { preHandler: authenticate }, reviewController.updateBookingReview);
  fastify.post('/:reviewId/response', { preHandler: [authenticate, requireRoles(['PROVIDER', 'ADMIN'])] }, reviewController.submitProviderResponse);
  fastify.post('/:reviewId/report', { preHandler: authenticate }, reviewController.reportReview);

  // Booking review shortcuts
  fastify.post('/booking/:bookingId', { preHandler: authenticate }, reviewController.createBookingReview);
  fastify.get('/booking/:bookingId', { preHandler: authenticate }, reviewController.getBookingReview);
  fastify.patch('/booking/:bookingId', { preHandler: authenticate }, reviewController.updateBookingReview);
}
