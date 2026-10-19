import { z } from 'zod';
import { QuoteStatus, QuoteStatusType } from '@localman/constants';
export type { QuoteStatusType };

export const QuoteItemDtoSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().min(0.01).default(1),
  unitPricePaisa: z.number().int().min(0),
  totalPaisa: z.number().int().min(0),
});
export type QuoteItemDto = z.infer<typeof QuoteItemDtoSchema>;

export const SubmitQuoteSchema = z.object({
  quoteAmountPaisa: z.number().int().min(100).max(50000000).optional(),
  subtotalPaisa: z.number().int().min(0).optional(),
  materialsPaisa: z.number().int().min(0).default(0),
  taxPaisa: z.number().int().min(0).default(0),
  totalAmountPaisa: z.number().int().min(100).max(50000000).optional(), // Max ₹5,00,000 bounds check
  estimatedDurationMinutes: z.number().int().min(15).max(14400).optional(), // Up to 10 days
  estimatedHours: z.number().min(0.5).max(100).optional(),
  breakdownNotes: z.string().min(5).max(2000),
  validityMinutes: z.number().int().min(15).max(10080).default(1440), // Default 24 hours
  items: z.array(QuoteItemDtoSchema).optional(),
  idempotencyKey: z.string().max(100).optional(),
});
export type SubmitQuoteInput = z.infer<typeof SubmitQuoteSchema>;
export const CreateQuoteSchema = SubmitQuoteSchema;
export type CreateQuoteInput = SubmitQuoteInput;

export const UpdateQuoteSchema = z.object({
  subtotalPaisa: z.number().int().min(0).optional(),
  materialsPaisa: z.number().int().min(0).optional(),
  taxPaisa: z.number().int().min(0).optional(),
  totalAmountPaisa: z.number().int().min(100).max(50000000).optional(),
  estimatedDurationMinutes: z.number().int().min(15).max(14400).optional(),
  breakdownNotes: z.string().min(5).max(2000).optional(),
  validityMinutes: z.number().int().min(15).max(10080).optional(),
  items: z.array(QuoteItemDtoSchema).optional(),
});
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>;

export const AcceptQuoteSchema = z.object({
  idempotencyKey: z.string().max(100).optional(),
});
export type AcceptQuoteInput = z.infer<typeof AcceptQuoteSchema>;

export const RejectQuoteSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RejectQuoteInput = z.infer<typeof RejectQuoteSchema>;

export const WithdrawQuoteSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type WithdrawQuoteInput = z.infer<typeof WithdrawQuoteSchema>;

export const ProviderPublicSummarySchema = z.object({
  id: z.string(),
  businessName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  ratingAverage: z.number(),
  ratingCount: z.number(),
  experienceYears: z.number().optional(),
});
export type ProviderPublicSummary = z.infer<typeof ProviderPublicSummarySchema>;

export const QuoteResponseSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  providerId: z.string(),
  provider: ProviderPublicSummarySchema,
  status: z.enum([
    QuoteStatus.REQUESTED,
    QuoteStatus.SUBMITTED,
    QuoteStatus.UPDATED,
    QuoteStatus.ACCEPTED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.WITHDRAWN,
    QuoteStatus.SUPERSEDED,
  ]),
  subtotalPaisa: z.number().int(),
  materialsPaisa: z.number().int(),
  taxPaisa: z.number().int(),
  totalAmountPaisa: z.number().int(),
  estimatedDurationMinutes: z.number().int(),
  breakdownNotes: z.string().nullable().optional(),
  items: z.array(QuoteItemDtoSchema).nullable().optional(),
  validUntil: z.string(),
  version: z.number().int(),
  isExpired: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  acceptedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
});
export type QuoteResponseDto = z.infer<typeof QuoteResponseSchema>;

export const QuoteListResponseSchema = z.object({
  quotes: z.array(QuoteResponseSchema),
  bookingId: z.string(),
  pricingModel: z.string(),
  acceptedQuoteId: z.string().nullable().optional(),
});
export type QuoteListResponseDto = z.infer<typeof QuoteListResponseSchema>;
