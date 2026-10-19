import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from './admin.service.js';
import {
  ReviewKycDocumentSchema,
  PaginationQuerySchema,
  UpdatePayoutStatusSchema,
  AdminManualAdjustmentSchema,
  QueryLedgerSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { z } from 'zod';
import { dispatchService } from '../dispatch/dispatch.service.js';
import { locationService } from '../location/location.service.js';

export class AdminController {
  private adminService = new AdminService();

  getMetrics = async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await this.adminService.getDashboardMetrics();
    return sendSuccess(reply, metrics, 200);
  };

  getPendingKycDocuments = async (_request: FastifyRequest, reply: FastifyReply) => {
    const docs = await this.adminService.getPendingKycDocuments();
    return sendSuccess(reply, docs, 200);
  };

  reviewKycDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = ReviewKycDocumentSchema.parse(request.body);
    const result = await this.adminService.reviewKycDocument(request.user.id, validated);
    return sendSuccess(reply, result, 200);
  };

  getAuditLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = PaginationQuerySchema.parse(request.query);
    const result = await this.adminService.getAuditLogs(query.page, query.limit);
    return sendSuccess(reply, result.logs, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  };

  // ---------------------------------------------------------------------------
  // Phase 2E: Financial Management & Oversight
  // ---------------------------------------------------------------------------

  getProviderWallet = async (
    request: FastifyRequest<{ Params: { providerId: string } }>,
    reply: FastifyReply
  ) => {
    const wallet = await this.adminService.getProviderWallet(request.params.providerId);
    return sendSuccess(reply, wallet, 200);
  };

  getFinancialLedger = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = QueryLedgerSchema.parse(request.query || {});
    const ledger = await this.adminService.getFinancialLedger(query);
    return sendSuccess(reply, ledger.entries, 200, {
      page: ledger.page,
      limit: ledger.limit,
      total: ledger.total,
    });
  };

  getPayouts = async (
    request: FastifyRequest<{ Querystring: { status?: string; page?: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const status = request.query.status;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
    const result = await this.adminService.getPayouts(status, page, limit);
    return sendSuccess(reply, result.payouts, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  };

  updatePayoutStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = UpdatePayoutStatusSchema.parse(request.body);
    const updated = await this.adminService.updatePayoutStatus(
      request.user.id,
      request.params.id,
      validated
    );
    return sendSuccess(reply, updated, 200);
  };

  adminManualAdjustment = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = AdminManualAdjustmentSchema.parse(request.body);
    const result = await this.adminService.adminManualAdjustment(request.user.id, validated);
    return sendSuccess(reply, result, 201);
  };

  expireStaleOffers = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const result = await dispatchService.expireStaleOffers();
    return sendSuccess(reply, result, 200);
  };

  pruneLocationLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const schema = z.object({ retentionDays: z.number().int().min(1).default(30) });
    const { retentionDays } = schema.parse(request.body || {});
    const deletedCount = await locationService.pruneOldLocationLogs(retentionDays, request.user.id);
    return sendSuccess(reply, { deletedCount, retentionDays }, 200);
  };
}
