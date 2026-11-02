import { FastifyInstance } from 'fastify';
import { mediaController } from './media.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

export async function mediaRoutes(fastify: FastifyInstance) {
  // Pre-signed upload URL generation
  fastify.post('/presign', { preHandler: authenticate }, mediaController.requestPresignedUrl);

  // Confirm media attachment upload
  fastify.post('/confirm', { preHandler: authenticate }, mediaController.confirmMediaAttachment);

  // Retrieve all categorized media for a booking
  fastify.get('/booking/:bookingId', { preHandler: authenticate }, mediaController.getBookingMedia);

  // Delete media attachment
  fastify.delete('/:mediaId', { preHandler: authenticate }, mediaController.deleteMedia);
}
