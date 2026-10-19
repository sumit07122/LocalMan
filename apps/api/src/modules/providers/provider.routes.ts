import { FastifyInstance } from 'fastify';
import { ProviderController } from './provider.controller.js';
import { cancellationController } from '../cancellations/cancellation.controller.js';
import { quoteController } from '../quotes/quote.controller.js';
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
  fastify.post('/location', controller.updateLocation);
  fastify.get('/location/status', controller.getLocationStatus);
  fastify.post('/toggle-online', controller.toggleOnline);

  // Provider Bookings (Phase 2A)
  fastify.get('/bookings', controller.getProviderBookings);
  fastify.get('/bookings/:id', controller.getProviderBookingDetails);
  fastify.post('/bookings/:id/accept', controller.acceptBooking);
  fastify.post('/bookings/:id/reject', controller.rejectBooking);

  // Phase 2C & Phase 3E: Job Execution Lifecycle
  // Dedicated Phase 3E operational endpoints
  fastify.post('/bookings/:id/on-the-way', controller.startTravel);
  fastify.post('/bookings/:id/arrived', controller.markArrived);
  fastify.post('/bookings/:id/start', controller.startJob);
  fastify.post('/bookings/:id/complete', controller.completeJob);
  // Backward compatibility with Phase 2C generic patch
  fastify.patch('/bookings/:id/job-status', controller.updateJobStatus);

  // Phase 3G Provider Cancellation & No-Show
  fastify.post('/bookings/:id/cancel', cancellationController.cancelProviderBooking);
  fastify.post('/bookings/:id/no-show', cancellationController.recordNoShow);

  // Phase 3H Provider Quote Marketplace
  fastify.post('/bookings/:id/quotes', quoteController.submitQuote);
  fastify.get('/bookings/:id/quotes', quoteController.getQuotesForBooking);
  fastify.patch('/quotes/:quoteId', quoteController.updateQuote);
  fastify.post('/quotes/:quoteId/withdraw', quoteController.withdrawQuote);

  // Phase 2C & 2E: Provider Wallet & Payout Ledger
  fastify.get('/wallet', controller.getProviderWallet);
  fastify.post('/wallet/payouts', controller.requestPayout);
  fastify.get('/wallet/ledger', controller.getProviderLedger);

  // Phase 2D: In-Job Materials / Spare Parts Request
  fastify.post('/bookings/:id/materials', controller.addMaterial);

  // Phase 2F: Real-Time Marketplace Dispatch & Offer Management
  fastify.get('/dispatch/offers', controller.getDispatchOffers);
  fastify.get('/dispatch/offers/active', controller.getActiveDispatchOffer);
  fastify.post('/dispatch/offers/:id/accept', controller.acceptDispatchOffer);
  fastify.post('/dispatch/offers/:id/reject', controller.rejectDispatchOffer);
  fastify.get('/dispatch/stream', controller.subscribeDispatchStream);
}
