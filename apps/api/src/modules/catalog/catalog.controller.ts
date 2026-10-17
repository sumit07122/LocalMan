import { FastifyRequest, FastifyReply } from 'fastify';
import { CatalogService } from './catalog.service.js';
import {
  SearchServicesQuerySchema,
  CreateCategorySchema,
  CreateServiceSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';

export class CatalogController {
  private catalogService = new CatalogService();

  getCategories = async (_request: FastifyRequest, reply: FastifyReply) => {
    const categories = await this.catalogService.getCategories();
    return sendSuccess(reply, categories, 200);
  };

  searchServices = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = SearchServicesQuerySchema.parse(request.query);
    const result = await this.catalogService.searchServices(query);
    return sendSuccess(reply, result.services, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  };

  getServiceById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const service = await this.catalogService.getServiceById(request.params.id);
    return sendSuccess(reply, service, 200);
  };

  createCategory = async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = CreateCategorySchema.parse(request.body);
    const result = await this.catalogService.createCategory(validated);
    return sendSuccess(reply, result, 201);
  };

  createService = async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = CreateServiceSchema.parse(request.body);
    const result = await this.catalogService.createService(validated);
    return sendSuccess(reply, result, 201);
  };
}
