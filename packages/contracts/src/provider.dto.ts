import { z } from 'zod';
import { KycDocumentType } from '@localman/constants';

export const UpdateProviderProfileSchema = z.object({
  businessName: z.string().min(2).max(150).optional(),
  bio: z.string().max(1000).optional(),
  experienceYears: z.number().int().min(0).max(60).default(0),
  bankAccountHolder: z.string().min(2).max(120).optional(),
  bankAccountNumber: z.string().min(8).max(30).optional(),
  bankIfscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid Indian IFSC code').optional(),
  upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. name@okhdfcbank)').optional(),
});
export type UpdateProviderProfileInput = z.infer<typeof UpdateProviderProfileSchema>;

export const SubmitKycDocumentSchema = z.object({
  documentType: z.enum([
    KycDocumentType.AADHAAR_FRONT,
    KycDocumentType.AADHAAR_BACK,
    KycDocumentType.PAN_CARD,
    KycDocumentType.POLICE_VERIFICATION,
    KycDocumentType.TRADE_CERTIFICATE,
    KycDocumentType.DRIVING_LICENSE,
  ]),
  documentNumber: z.string().min(4).max(50),
  fileUrl: z
    .string()
    .url('File URL must be a valid presigned cloud storage URL')
    .optional()
    .default('https://storage.localman.in/kyc/default_doc.jpg'),
});
export type SubmitKycDocumentInput = z.infer<typeof SubmitKycDocumentSchema>;

export const ReviewKycDocumentSchema = z.object({
  documentId: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().optional(),
});
export type ReviewKycDocumentInput = z.infer<typeof ReviewKycDocumentSchema>;

export const UpdateLocationBeaconSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(5000).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(75).optional(),
  timestamp: z.union([z.string().datetime(), z.number()]).optional(),
  source: z.string().max(50).optional().default('FOREGROUND_APP'),
  bookingId: z.string().min(1).max(100).optional(),
});
export type UpdateLocationBeaconInput = z.infer<typeof UpdateLocationBeaconSchema>;

export const SetAvailabilitySchema = z.object({
  schedule: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
      isActive: z.boolean().default(true),
    })
  ),
});
export type SetAvailabilityInput = z.infer<typeof SetAvailabilitySchema>;

export const RejectBookingSchema = z.object({
  reason: z.string().max(255).optional(),
});
export type RejectBookingInput = z.infer<typeof RejectBookingSchema>;

/**
 * Phase 2C: Provider job execution status DTO
 * Only execution-phase transitions are allowed through this endpoint.
 * The server derives provider identity from JWT — no actorId, providerId,
 * or financial fields are accepted from the client.
 */
export const UpdateJobStatusSchema = z.object({
  status: z.enum([
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'JOB_STARTED',
    'JOB_COMPLETED',
  ]),
  startOtp: z.string().length(6).optional(),  // Required only when status = JOB_STARTED
  reason: z.string().max(255).optional(),      // Optional audit note
});
export type UpdateJobStatusInput = z.infer<typeof UpdateJobStatusSchema>;

/**
 * Phase 3E: Specialized Provider Job Lifecycle Schemas
 */
export const StartJobSchema = z.object({
  startOtp: z.string().regex(/^\d{6}$/, 'Start OTP must be exactly 6 digits'),
});
export type StartJobInput = z.infer<typeof StartJobSchema>;

export const CompleteJobSchema = z.object({
  reason: z.string().max(255).optional(),
});
export type CompleteJobInput = z.infer<typeof CompleteJobSchema>;

export const TravelStatusSchema = z.object({
  reason: z.string().max(255).optional(),
});
export type TravelStatusInput = z.infer<typeof TravelStatusSchema>;

export const ArrivedStatusSchema = z.object({
  reason: z.string().max(255).optional(),
});
export type ArrivedStatusInput = z.infer<typeof ArrivedStatusSchema>;


