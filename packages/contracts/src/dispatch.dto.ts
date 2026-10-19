import { z } from 'zod';

export const DispatchOfferStatusEnum = {
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type DispatchOfferStatusType = (typeof DispatchOfferStatusEnum)[keyof typeof DispatchOfferStatusEnum];

export const RespondDispatchOfferSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
  rejectionReason: z.string().max(255).optional(),
});
export type RespondDispatchOfferInput = z.infer<typeof RespondDispatchOfferSchema>;

export const QueryDispatchOffersSchema = z.object({
  status: z.enum(['OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryDispatchOffersInput = z.infer<typeof QueryDispatchOffersSchema>;

export const TriggerManualDispatchSchema = z.object({
  preferredProviderId: z.string().uuid().optional(),
});
export type TriggerManualDispatchInput = z.infer<typeof TriggerManualDispatchSchema>;

export const DispatchOfferSummarySchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  providerId: z.string(),
  status: z.enum(['OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  attemptNumber: z.number().int(),
  expiresAt: z.string(),
  createdAt: z.string(),
  respondedAt: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
});
export type DispatchOfferSummary = z.infer<typeof DispatchOfferSummarySchema>;

export const RealtimeEventEnvelopeSchema = z.object({
  type: z.string(),
  channel: z.string(),
  payload: z.any(),
  timestamp: z.string(),
});
export type RealtimeEventEnvelope = z.infer<typeof RealtimeEventEnvelopeSchema>;
