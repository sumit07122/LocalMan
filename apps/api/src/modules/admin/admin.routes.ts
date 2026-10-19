import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller.js';
import { disputeController } from '../disputes/dispute.controller.js';
import { quoteController } from '../quotes/quote.controller.js';
import { chatController } from '../chat/chat.controller.js';
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

  // Phase 2E: Financial Oversight & Adjustments
  fastify.get('/financial/wallets/:providerId', controller.getProviderWallet);
  fastify.get('/financial/ledger', controller.getFinancialLedger);
  fastify.get('/financial/payouts', controller.getPayouts);
  fastify.post('/financial/payouts/:id/status', controller.updatePayoutStatus);
  fastify.post('/financial/adjustments', controller.adminManualAdjustment);

  // Phase 2F: Stale Offer Sweep Trigger
  fastify.post('/dispatch/expire-stale', controller.expireStaleOffers);

  // Phase 2G: Location Retention Pruner
  fastify.post('/location/prune', controller.pruneLocationLogs);

  // Phase 3G: Dispute Oversight & Resolution
  fastify.get('/disputes', disputeController.listAdminDisputes);
  fastify.get('/disputes/:id', disputeController.getDisputeById);
  fastify.post('/disputes/:id/resolve', disputeController.resolveDispute);

  // Phase 3H: Quote Oversight & Expiry Sweep
  fastify.get('/bookings/:bookingId/quotes', quoteController.getQuotesForBooking);
  fastify.post('/quotes/expire-stale', quoteController.expireStaleQuotes);

  // Phase 3I: Chat Oversight
  fastify.get('/bookings/:bookingId/messages', chatController.adminGetMessages);
}
