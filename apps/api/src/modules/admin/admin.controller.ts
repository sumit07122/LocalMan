import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from './admin.service.js';
import { ReviewKycDocumentSchema, PaginationQuerySchema } from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';

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
}
