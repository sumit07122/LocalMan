import { prisma } from '../../config/database.js';
import {
  CreateCategoryInput,
  CreateServiceInput,
  SearchServicesQuery,
} from '@localman/contracts';
import { NotFoundError } from '../../common/errors/app-error.js';

export class CatalogService {
  /**
   * Retrieves all active root categories with their hierarchical subcategories and service counts
   */
  async getCategories() {
    const categories = await prisma.serviceCategory.findMany({
      where: {
        isActive: true,
        parentId: null, // Root categories only
      },
      include: {
        children: {
          where: { isActive: true },
          include: {
            _count: {
              select: { services: { where: { isActive: true } } },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { services: { where: { isActive: true } } },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      name: c.name,
      slug: c.slug,
      iconUrl: c.iconUrl,
      imageUrl: c.imageUrl,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      serviceCount: c._count.services,
      children: c.children.map((sub) => ({
        id: sub.id,
        parentId: sub.parentId,
        name: sub.name,
        slug: sub.slug,
        iconUrl: sub.iconUrl,
        imageUrl: sub.imageUrl,
        displayOrder: sub.displayOrder,
        isActive: sub.isActive,
        serviceCount: sub._count.services,
      })),
    }));
  }

  /**
   * Retrieves a single category by UUID or slug with its active services
   */
  async getCategoryById(idOrSlug: string) {
    const category = await prisma.serviceCategory.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        services: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { services: { where: { isActive: true } } },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      iconUrl: category.iconUrl,
      imageUrl: category.imageUrl,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      serviceCount: category._count.services,
      children: category.children.map((sub) => ({
        id: sub.id,
        parentId: sub.parentId,
        name: sub.name,
        slug: sub.slug,
        iconUrl: sub.iconUrl,
        imageUrl: sub.imageUrl,
        displayOrder: sub.displayOrder,
        isActive: sub.isActive,
      })),
      services: category.services.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        categoryName: category.name,
        name: s.name,
        slug: s.slug,
        description: s.description,
        pricingModel: s.pricingModel,
        basePricePaisa: s.basePricePaisa,
        hourlyRatePaisa: s.hourlyRatePaisa,
        inspectionFeePaisa: s.inspectionFeePaisa,
        estimatedDurationMinutes: s.estimatedDurationMinutes,
        isMaterialAllowed: s.isMaterialAllowed,
        isActive: s.isActive,
        createdAt: s.createdAt ? (s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt)) : new Date().toISOString(),
        updatedAt: s.updatedAt ? (s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt)) : new Date().toISOString(),
      })),
    };
  }

  /**
   * Searches and filters services with bounded pagination and sorting
   */
  async searchServices(query: SearchServicesQuery) {
    const { categoryId, query: searchText, pricingModel, sort, page, limit } = query;
    const boundedLimit = Math.min(Math.max(limit, 1), 50);
    const skip = (page - 1) * boundedLimit;

    const whereClause: any = {
      isActive: true,
      category: {
        isActive: true,
      },
    };

    if (categoryId) {
      whereClause.category = {
        isActive: true,
        OR: [{ id: categoryId }, { slug: categoryId }],
      };
    }

    if (pricingModel) {
      whereClause.pricingModel = pricingModel;
    }

    if (searchText && searchText.trim().length > 0) {
      whereClause.OR = [
        { name: { contains: searchText.trim(), mode: 'insensitive' } },
        { description: { contains: searchText.trim(), mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { name: 'asc' };
    if (sort === 'name_desc') {
      orderBy = { name: 'desc' };
    } else if (sort === 'price_asc') {
      orderBy = { basePricePaisa: 'asc' };
    } else if (sort === 'price_desc') {
      orderBy = { basePricePaisa: 'desc' };
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
        take: boundedLimit,
        orderBy,
      }),
      prisma.service.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / boundedLimit);

    return {
      services: services.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        categoryName: s.category?.name,
        name: s.name,
        slug: s.slug,
        description: s.description,
        pricingModel: s.pricingModel,
        basePricePaisa: s.basePricePaisa,
        hourlyRatePaisa: s.hourlyRatePaisa,
        inspectionFeePaisa: s.inspectionFeePaisa,
        estimatedDurationMinutes: s.estimatedDurationMinutes,
        isMaterialAllowed: s.isMaterialAllowed,
        isActive: s.isActive,
        createdAt: s.createdAt ? (s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt)) : new Date().toISOString(),
        updatedAt: s.updatedAt ? (s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt)) : new Date().toISOString(),
      })),
      pagination: {
        page,
        limit: boundedLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves single service by unique slug or UUID without leaking admin fields
   */
  async getServiceById(idOrSlug: string) {
    const service = await prisma.service.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
        category: {
          isActive: true,
        },
      },
      include: {
        category: true,
      },
    });

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    return {
      id: service.id,
      categoryId: service.categoryId,
      categoryName: service.category.name,
      name: service.name,
      slug: service.slug,
      description: service.description,
      pricingModel: service.pricingModel,
      basePricePaisa: service.basePricePaisa,
      hourlyRatePaisa: service.hourlyRatePaisa,
      inspectionFeePaisa: service.inspectionFeePaisa,
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      isMaterialAllowed: service.isMaterialAllowed,
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
      category: {
        id: service.category.id,
        parentId: service.category.parentId,
        name: service.category.name,
        slug: service.category.slug,
        iconUrl: service.category.iconUrl,
        imageUrl: service.category.imageUrl,
        displayOrder: service.category.displayOrder,
        isActive: service.category.isActive,
      },
    };
  }

  /**
   * Admin: Creates a new service category
   */
  async createCategory(input: CreateCategoryInput) {
    return prisma.serviceCategory.create({
      data: {
        name: input.name,
        slug: input.slug,
        parentId: input.parentId || null,
        iconUrl: input.iconUrl || null,
        imageUrl: input.imageUrl || null,
        displayOrder: input.displayOrder,
      },
    });
  }

  /**
   * Admin: Creates a new service in the catalog
   */
  async createService(input: CreateServiceInput, actorUserId?: string) {
    const commissionPercent = input.platformCommissionPercent ?? 15.0;
    const service = await prisma.service.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        pricingModel: input.pricingModel,
        basePricePaisa: input.basePricePaisa,
        hourlyRatePaisa: input.hourlyRatePaisa || null,
        inspectionFeePaisa: input.inspectionFeePaisa || null,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        isMaterialAllowed: input.isMaterialAllowed,
        platformCommissionPercent: commissionPercent,
      },
    });

    // Audited administrative logging if non-canonical commission rate is set
    if (commissionPercent !== 15.0) {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId || 'SYSTEM',
          action: 'SERVICE_COMMISSION_OVERRIDE_CREATED',
          resourceType: 'service',
          resourceId: service.id,
          newState: {
            serviceId: service.id,
            serviceName: service.name,
            platformCommissionPercent: commissionPercent,
            canonicalDefaultPercent: 15.0,
          },
        },
      });
    }

    return service;
  }
}
