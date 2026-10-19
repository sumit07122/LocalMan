import { z } from 'zod';
import { PricingModel } from '@localman/constants';

// -----------------------------------------------------------------------------
// ADMIN MUTATION SCHEMAS
// -----------------------------------------------------------------------------

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(120),
  parentId: z.string().optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  displayOrder: z.number().int().default(0),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const CreateServiceSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2).max(150),
  slug: z.string().min(2).max(180),
  description: z.string().optional().nullable(),
  pricingModel: z.enum([
    PricingModel.HOURLY,
    PricingModel.FIXED_PRICE,
    PricingModel.INSPECTION_QUOTE,
    PricingModel.CUSTOM_QUOTE,
  ]),
  basePricePaisa: z.number().int().min(0).default(0),
  hourlyRatePaisa: z.number().int().min(0).optional().nullable(),
  inspectionFeePaisa: z.number().int().min(0).optional().nullable(),
  estimatedDurationMinutes: z.number().int().min(15).default(60),
  isMaterialAllowed: z.boolean().default(true),
  platformCommissionPercent: z.number().min(0).max(100).default(15.0),
});
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;

// -----------------------------------------------------------------------------
// CUSTOMER-FACING CATALOG RESPONSE SCHEMAS
// -----------------------------------------------------------------------------

export const ServicePricingSchema = z.object({
  pricingModel: z.enum([
    PricingModel.HOURLY,
    PricingModel.FIXED_PRICE,
    PricingModel.INSPECTION_QUOTE,
    PricingModel.CUSTOM_QUOTE,
  ]),
  basePricePaisa: z.number().int().min(0),
  hourlyRatePaisa: z.number().int().min(0).nullable().optional(),
  inspectionFeePaisa: z.number().int().min(0).nullable().optional(),
  isMaterialAllowed: z.boolean(),
});
export type ServicePricing = z.infer<typeof ServicePricingSchema>;

export type CategoryResponse = {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  iconUrl?: string | null;
  imageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  serviceCount?: number;
  children?: CategoryResponse[];
};

export const CategoryResponseSchema: z.ZodType<CategoryResponse> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable().optional(),
    name: z.string(),
    slug: z.string(),
    iconUrl: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    displayOrder: z.number().int(),
    isActive: z.boolean(),
    serviceCount: z.number().int().optional(),
    children: z.array(CategoryResponseSchema).optional(),
  })
);

export const ServiceResponseSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  categoryName: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  pricingModel: z.enum([
    PricingModel.HOURLY,
    PricingModel.FIXED_PRICE,
    PricingModel.INSPECTION_QUOTE,
    PricingModel.CUSTOM_QUOTE,
  ]),
  basePricePaisa: z.number().int(),
  hourlyRatePaisa: z.number().int().nullable().optional(),
  inspectionFeePaisa: z.number().int().nullable().optional(),
  estimatedDurationMinutes: z.number().int(),
  isMaterialAllowed: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;

export const CategoryDetailResponseSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable().optional(),
  name: z.string(),
  slug: z.string(),
  iconUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  serviceCount: z.number().int().optional(),
  children: z.array(CategoryResponseSchema).optional(),
  services: z.array(ServiceResponseSchema),
});
export type CategoryDetailResponse = z.infer<typeof CategoryDetailResponseSchema>;

export const ServiceDetailResponseSchema = ServiceResponseSchema.extend({
  category: CategoryResponseSchema,
});
export type ServiceDetailResponse = z.infer<typeof ServiceDetailResponseSchema>;

export const CatalogPaginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type CatalogPagination = z.infer<typeof CatalogPaginationSchema>;

export const ServiceListResponseSchema = z.object({
  services: z.array(ServiceResponseSchema),
  pagination: CatalogPaginationSchema,
});
export type ServiceListResponse = z.infer<typeof ServiceListResponseSchema>;

// -----------------------------------------------------------------------------
// SEARCH / FILTER QUERY SCHEMA
// -----------------------------------------------------------------------------

export const SearchServicesQuerySchema = z.object({
  query: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  pricingModel: z
    .enum([
      PricingModel.HOURLY,
      PricingModel.FIXED_PRICE,
      PricingModel.INSPECTION_QUOTE,
      PricingModel.CUSTOM_QUOTE,
    ])
    .optional(),
  sort: z.enum(['name_asc', 'name_desc', 'price_asc', 'price_desc']).optional().default('name_asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchServicesQuery = z.infer<typeof SearchServicesQuerySchema>;
