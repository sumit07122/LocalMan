import { z } from 'zod';
import {
  ReviewStatus,
  ReviewStatusType,
  ReviewReportReason,
  ReviewReportReasonType,
  REVIEW_CONSTRAINTS,
} from '@localman/constants';

export type { ReviewStatusType, ReviewReportReasonType };

export const CreateReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(REVIEW_CONSTRAINTS.MIN_RATING, `Rating must be at least ${REVIEW_CONSTRAINTS.MIN_RATING}`)
    .max(REVIEW_CONSTRAINTS.MAX_RATING, `Rating cannot exceed ${REVIEW_CONSTRAINTS.MAX_RATING}`),
  title: z
    .string()
    .trim()
    .max(REVIEW_CONSTRAINTS.MAX_TITLE_LENGTH, `Title cannot exceed ${REVIEW_CONSTRAINTS.MAX_TITLE_LENGTH} characters`)
    .optional(),
  body: z
    .string()
    .trim()
    .max(REVIEW_CONSTRAINTS.MAX_BODY_LENGTH, `Body cannot exceed ${REVIEW_CONSTRAINTS.MAX_BODY_LENGTH} characters`)
    .optional(),
  comment: z.string().trim().max(REVIEW_CONSTRAINTS.MAX_BODY_LENGTH).optional(),
  photos: z.array(z.string().url('Photo must be a valid URL')).max(5, 'Maximum 5 photos allowed').optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const UpdateReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(REVIEW_CONSTRAINTS.MIN_RATING)
    .max(REVIEW_CONSTRAINTS.MAX_RATING)
    .optional(),
  title: z
    .string()
    .trim()
    .max(REVIEW_CONSTRAINTS.MAX_TITLE_LENGTH)
    .optional(),
  body: z
    .string()
    .trim()
    .max(REVIEW_CONSTRAINTS.MAX_BODY_LENGTH)
    .optional(),
  comment: z.string().trim().max(REVIEW_CONSTRAINTS.MAX_BODY_LENGTH).optional(),
  photos: z.array(z.string().url('Photo must be a valid URL')).max(5, 'Maximum 5 photos allowed').optional(),
});
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

export const ProviderResponseSchema = z.object({
  response: z
    .string()
    .trim()
    .min(REVIEW_CONSTRAINTS.MIN_RESPONSE_LENGTH, `Response must be at least ${REVIEW_CONSTRAINTS.MIN_RESPONSE_LENGTH} characters`)
    .max(REVIEW_CONSTRAINTS.MAX_RESPONSE_LENGTH, `Response cannot exceed ${REVIEW_CONSTRAINTS.MAX_RESPONSE_LENGTH} characters`),
});
export type ProviderResponseInput = z.infer<typeof ProviderResponseSchema>;

export const ReportReviewSchema = z.object({
  reason: z.enum([
    ReviewReportReason.INAPPROPRIATE_CONTENT,
    ReviewReportReason.OFFENSIVE_LANGUAGE,
    ReviewReportReason.SPAM,
    ReviewReportReason.FAKE_REVIEW,
    ReviewReportReason.HARASSMENT,
    ReviewReportReason.OTHER,
  ] as const),
  details: z
    .string()
    .trim()
    .max(REVIEW_CONSTRAINTS.MAX_REPORT_DETAILS_LENGTH, `Details cannot exceed ${REVIEW_CONSTRAINTS.MAX_REPORT_DETAILS_LENGTH} characters`)
    .optional(),
});
export type ReportReviewInput = z.infer<typeof ReportReviewSchema>;

export const ModerateReviewSchema = z.object({
  status: z.enum([
    ReviewStatus.PUBLISHED,
    ReviewStatus.HIDDEN,
    ReviewStatus.REMOVED,
    ReviewStatus.FLAGGED,
  ] as const),
  moderationReason: z
    .string()
    .trim()
    .min(REVIEW_CONSTRAINTS.MIN_MODERATION_REASON_LENGTH, `Moderation reason must be at least ${REVIEW_CONSTRAINTS.MIN_MODERATION_REASON_LENGTH} characters`)
    .max(REVIEW_CONSTRAINTS.MAX_MODERATION_REASON_LENGTH, `Moderation reason cannot exceed ${REVIEW_CONSTRAINTS.MAX_MODERATION_REASON_LENGTH} characters`),
});
export type ModerateReviewInput = z.infer<typeof ModerateReviewSchema>;

export const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(REVIEW_CONSTRAINTS.MAX_PAGE_SIZE).default(REVIEW_CONSTRAINTS.DEFAULT_PAGE_SIZE),
  status: z.enum([
    ReviewStatus.PENDING,
    ReviewStatus.PUBLISHED,
    ReviewStatus.HIDDEN,
    ReviewStatus.REMOVED,
    ReviewStatus.FLAGGED,
  ] as const).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  flaggedOnly: z.coerce.boolean().optional(),
});
export type ReviewQueryInput = z.infer<typeof ReviewQuerySchema>;

export interface PublicReviewDto {
  id: string;
  bookingId: string;
  rating: number;
  title: string | null;
  body: string | null;
  photos?: string[];
  providerResponse: string | null;
  providerRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerAvatarUrl?: string | null;
}

export interface ReviewDetailDto extends PublicReviewDto {
  customerId: string;
  providerId: string;
  status: ReviewStatusType;
  isFlagged: boolean;
  canEdit: boolean;
  editWindowExpiresAt: string;
  moderatedAt?: string | null;
  moderationReason?: string | null;
}

export interface ProviderReputationDto {
  providerId: string;
  averageRating: number;
  publishedReviewCount: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
