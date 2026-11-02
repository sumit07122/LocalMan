import { FastifyRequest, FastifyReply } from 'fastify';
import { CatalogService } from './catalog.service.js';
import {
  SearchServicesQuerySchema,
  CreateCategorySchema,
  CreateServiceSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';

export class CatalogController {
  private catalogService = new CatalogService();

  getCategories = async (_request: FastifyRequest, reply: FastifyReply) => {
    const categories = await this.catalogService.getCategories();
    return sendSuccess(reply, categories, 200);
  };

  getCategoryById = async (
    request: FastifyRequest<{ Params: { categoryId?: string; id?: string } }>,
    reply: FastifyReply
  ) => {
    const id = request.params.categoryId || request.params.id;
    if (!id) {
      throw new NotFoundError('Category ID is required');
    }
    const category = await this.catalogService.getCategoryById(id);
    return sendSuccess(reply, category, 200);
  };

  searchServices = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = SearchServicesQuerySchema.parse(request.query);
    const result = await this.catalogService.searchServices(query);
    return sendSuccess(reply, result.services, 200, {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
    });
  };

  getServiceById = async (
    request: FastifyRequest<{ Params: { serviceId?: string; id?: string } }>,
    reply: FastifyReply
  ) => {
    const id = request.params.serviceId || request.params.id;
    if (!id) {
      throw new NotFoundError('Service ID is required');
    }
    const service = await this.catalogService.getServiceById(id);
    return sendSuccess(reply, service, 200);
  };

  createCategory = async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = CreateCategorySchema.parse(request.body);
    const result = await this.catalogService.createCategory(validated);
    return sendSuccess(reply, result, 201);
  };

  createService = async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = CreateServiceSchema.parse(request.body);
    const user = request.user;

    // Platform Fee Governance: Canonical rate is 15.0%.
    // Only Super Admin can specify a non-canonical commission rate upon service creation.
    if (
      validated.platformCommissionPercent !== undefined &&
      validated.platformCommissionPercent !== 15.0
    ) {
      const isAdmin = user?.roles?.includes('ADMIN');
      if (!isAdmin) {
        throw new ForbiddenError(
          'Non-standard platform commission can only be configured by Super Admin'
        );
      }
    }

    const result = await this.catalogService.createService(validated, user?.id);
    return sendSuccess(reply, result, 201);
  };
}
