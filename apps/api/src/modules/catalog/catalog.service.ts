import { prisma } from '../../config/database.js';
import {
  CreateCategoryInput,
  CreateServiceInput,
  SearchServicesQuery,
} from '@localman/contracts';
import { NotFoundError } from '../../common/errors/app-error.js';

export class CatalogService {
  /**
   * Retrieves all active categories organized with their hierarchical subcategories
   */
  async getCategories() {
    const categories = await prisma.serviceCategory.findMany({
      where: {
        isActive: true,
        parentId: null, // Root categories
      },
      include: {
        children: {
          where: { isActive: true },
          include: {
            _count: {
              select: { services: true },
            },
          },
        },
        _count: {
          select: { services: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return categories;
  }

  /**
   * Searches and filters services with pagination
   */
  async searchServices(query: SearchServicesQuery) {
    const { categoryId, query: searchText, pricingModel, page, limit } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      isActive: true,
    };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (pricingModel) {
      whereClause.pricingModel = pricingModel;
    }

    if (searchText && searchText.trim().length > 0) {
      whereClause.OR = [
        { name: { contains: searchText, mode: 'insensitive' } },
        { description: { contains: searchText, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where: whereClause,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.service.count({ where: whereClause }),
    ]);

    return {
      services: services.map((s) => ({
        ...s,
        platformCommissionPercent: Number(s.platformCommissionPercent),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single service by unique slug or ID
   */
  async getServiceById(id: string) {
    const service = await prisma.service.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    return {
      ...service,
      platformCommissionPercent: Number(service.platformCommissionPercent),
    };
  }

  /**
   * Admin: Creates a new service category
   */
  async createCategory(input: CreateCategoryInput) {
    return prisma.serviceCategory.create({
      data: input,
    });
  }

  /**
   * Admin: Creates a new service in the catalog
   */
  async createService(input: CreateServiceInput) {
    return prisma.service.create({
      data: {
        ...input,
        platformCommissionPercent: input.platformCommissionPercent,
      },
    });
  }
}
