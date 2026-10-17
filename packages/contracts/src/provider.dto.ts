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
  fileUrl: z.string().url('File URL must be a valid presigned cloud storage URL'),
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
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
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
