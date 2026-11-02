import { FastifyInstance } from 'fastify';
import { BookingController } from './booking.controller.js';
import { paymentController } from '../payments/payment.controller.js';
import { cancellationController } from '../cancellations/cancellation.controller.js';
import { disputeController } from '../disputes/dispute.controller.js';
import { quoteController } from '../quotes/quote.controller.js';
import { chatController } from '../chat/chat.controller.js';
import { reviewController } from '../reviews/review.controller.js';
import { mediaController } from '../media/media.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

export async function bookingRoutes(fastify: FastifyInstance) {
  const controller = new BookingController();

  // All booking routes require authentication
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', controller.createBooking);
  fastify.get('/', controller.listBookings);
  fastify.get('/customer/my', controller.getCustomerBookings);
  fastify.get('/provider/my', controller.getProviderBookings);
  fastify.get('/:id', controller.getBookingDetails);
  fastify.patch('/:id/status', controller.updateStatus);
  fastify.post('/:id/materials', controller.addMaterial);
  fastify.patch('/:id/materials/approve', controller.approveMaterial);
  fastify.post('/:id/dispatch', controller.triggerDispatch);
  fastify.get('/:id/dispatch-status', controller.getDispatchStatus);
  // Phase 2G & Phase 3K: Live Maps, Location & ETA
  fastify.get('/:id/provider-location', controller.getProviderLocation);
  fastify.get('/:id/location', controller.getProviderLocation);
  fastify.get('/:id/map-state', controller.getBookingMapState);
  fastify.get('/:id/eta', controller.getBookingEta);
  fastify.get('/:id/stream', controller.subscribeBookingStream);

  // Phase 3F Customer Payment endpoints under /bookings/:bookingId/payment/...
  fastify.post('/:bookingId/payment/checkout', paymentController.createCheckoutSession);
  fastify.post('/:bookingId/payment/verify', paymentController.verifyPayment);
  fastify.get('/:bookingId/payment/summary', paymentController.getPaymentSummary);

  // Phase 3G Cancellation, No-Show & Dispute endpoints
  fastify.post('/:bookingId/cancel', cancellationController.cancelCustomerBooking);
  fastify.post('/:bookingId/no-show', cancellationController.recordNoShow);
  fastify.post('/:bookingId/disputes', disputeController.openDispute);
  fastify.get('/:bookingId/disputes', disputeController.getDisputesForBooking);

  // Phase 3H Quote Marketplace Customer endpoints
  fastify.get('/:bookingId/quotes', quoteController.getQuotesForBooking);
  fastify.get('/:bookingId/quotes/:quoteId', quoteController.getQuoteById);
  fastify.post('/:bookingId/quotes/:quoteId/accept', quoteController.acceptQuote);
  fastify.post('/:bookingId/quotes/:quoteId/reject', quoteController.rejectQuote);
  fastify.post('/:bookingId/quotes', quoteController.submitQuote); // Backwards compatible fallback

  // Phase 3I Chat & Messaging endpoints
  fastify.get('/:bookingId/messages/conversation', chatController.getConversation);
  fastify.get('/:bookingId/messages', chatController.listMessages);
  fastify.post('/:bookingId/messages', chatController.sendMessage);
  fastify.post('/:bookingId/messages/read', chatController.markRead);
  fastify.get('/:bookingId/messages/stream', chatController.subscribeStream);

  // Phase 3J Review & Rating endpoints under /bookings/:bookingId/review
  fastify.post('/:bookingId/review', reviewController.createBookingReview);
  fastify.get('/:bookingId/review', reviewController.getBookingReview);
  fastify.patch('/:bookingId/review', reviewController.updateBookingReview);

  // Phase 3L Media & Object Storage endpoints under /bookings/:id/media
  fastify.get('/:id/media', mediaController.getBookingMedia);
}
