import { z } from 'zod';
import { DisputeStatus } from '@localman/constants';


// -----------------------------------------------------------------------------
// CANCELLATION DTOs
// -----------------------------------------------------------------------------

export const CancelBookingSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional(),
});
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;

export interface CancellationResultDto {
  bookingId: string;
  bookingStatus: string;
  cancellationStatus: string;
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: string;
  cancellationFeePaisa: number;
  refundAmountPaisa: number;
  refundStatus: string;
  policyExplanation: string;
}

// -----------------------------------------------------------------------------
// NO-SHOW DTOs
// -----------------------------------------------------------------------------

export const RecordNoShowSchema = z.object({
  reason: z.string().min(1, 'Reason is required').default('NO_SHOW'),
  notes: z.string().max(500).optional(),
  waitingMinutes: z.number().int().min(0).optional(),
});
export type RecordNoShowInput = z.infer<typeof RecordNoShowSchema>;

export interface NoShowResultDto {
  bookingId: string;
  noShowActor: 'CUSTOMER' | 'PROVIDER';
  recordedBy: string;
  recordedAt: string;
  feePaisa: number;
  compensationPaisa: number;
  refundAmountPaisa: number;
  bookingStatus: string;
  explanation: string;
}

// -----------------------------------------------------------------------------
// DISPUTE DTOs
// -----------------------------------------------------------------------------

export const CreateDisputeSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  reason: z.string().min(1, 'Dispute reason is required'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  disputedAmountPaisa: z.number().int().min(0).optional(),
  evidenceUrls: z.array(z.string().url()).max(5).optional(),
});
export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>;

export const ResolveDisputeSchema = z.object({
  resolution: z.enum([
    DisputeStatus.RESOLVED_CUSTOMER,
    DisputeStatus.RESOLVED_PROVIDER,
    DisputeStatus.RESOLVED_PARTIAL,
    DisputeStatus.CLOSED,
  ]),
  resolutionNotes: z.string().min(5, 'Resolution notes must be at least 5 characters').max(2000),
  refundAmountPaisa: z.number().int().min(0).optional(),
  providerDebitPaisa: z.number().int().min(0).optional(),
});
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;

export interface DisputeResponseDto {
  id: string;
  ticketNumber: string;
  bookingId: string;
  raisedBy: string;
  actorRole: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  disputedAmountPaisa?: number;
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// REFUND DTOs
// -----------------------------------------------------------------------------

export interface RefundResultDto {
  refundId: string;
  paymentId: string;
  bookingId: string;
  originalAmountPaisa: number;
  refundAmountPaisa: number;
  remainingRefundablePaisa: number;
  gatewayRefundId?: string | null;
  status: string;
  reason: string;
  initiatedBy: string;
  createdAt: string;
}
