import { z } from 'zod';

export const RequestPayoutSchema = z.object({
  amountPaisa: z.number().int().min(10000, 'Minimum withdrawal amount is ₹100 (10,000 paisa)').optional(),
  payoutMode: z.enum(['BANK_TRANSFER', 'UPI']).default('BANK_TRANSFER'),
});
export type RequestPayoutInput = z.infer<typeof RequestPayoutSchema>;

export const UpdatePayoutStatusSchema = z.object({
  status: z.enum(['PAID', 'FAILED']),
  payoutReference: z.string().max(100).optional(),
  failureReason: z.string().max(500).optional(),
});
export type UpdatePayoutStatusInput = z.infer<typeof UpdatePayoutStatusSchema>;

export const AdminManualAdjustmentSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  amountPaisa: z.number().int().positive('Adjustment amount must be a positive integer in paisa'),
  direction: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});
export type AdminManualAdjustmentInput = z.infer<typeof AdminManualAdjustmentSchema>;

export const QueryLedgerSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entryType: z.string().optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
});
export type QueryLedgerInput = z.infer<typeof QueryLedgerSchema>;
