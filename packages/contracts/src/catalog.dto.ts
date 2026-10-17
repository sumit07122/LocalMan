import { z } from 'zod';
import { PricingModel } from '@localman/constants';

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(120),
  parentId: z.string().optional(),
  iconUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  displayOrder: z.number().int().default(0),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const CreateServiceSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2).max(150),
  slug: z.string().min(2).max(180),
  description: z.string().optional(),
  pricingModel: z.enum([
    PricingModel.HOURLY,
    PricingModel.FIXED_PRICE,
    PricingModel.INSPECTION_QUOTE,
    PricingModel.CUSTOM_QUOTE,
  ]),
  basePricePaisa: z.number().int().min(0).default(0),
  hourlyRatePaisa: z.number().int().min(0).optional(),
  inspectionFeePaisa: z.number().int().min(0).optional(),
  estimatedDurationMinutes: z.number().int().min(15).default(60),
  isMaterialAllowed: z.boolean().default(true),
  platformCommissionPercent: z.number().min(0).max(100).default(15.0),
});
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;

export const SearchServicesQuerySchema = z.object({
  query: z.string().optional(),
  categoryId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().int().min(1000).max(50000).default(15000),
  pricingModel: z
    .enum([
      PricingModel.HOURLY,
      PricingModel.FIXED_PRICE,
      PricingModel.INSPECTION_QUOTE,
      PricingModel.CUSTOM_QUOTE,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchServicesQuery = z.infer<typeof SearchServicesQuerySchema>;
