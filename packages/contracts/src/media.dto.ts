import { z } from 'zod';
import {
  MediaPurpose,
  MediaPurposeType,
  MEDIA_PURPOSES,
  ALL_ALLOWED_MEDIA_MIME_TYPES,
  MEDIA_CONSTRAINTS,
} from '@localman/constants';

export { MediaPurpose };
export type { MediaPurposeType };

export const MediaPurposeEnum = z.enum(
  MEDIA_PURPOSES as [string, ...string[]]
);

export const AllowedMimeTypeEnum = z.enum(
  ALL_ALLOWED_MEDIA_MIME_TYPES as unknown as [string, ...string[]]
);

export const RequestPresignedUploadUrlSchema = z.object({
  purpose: MediaPurposeEnum,
  entityId: z.string().min(1, 'Entity ID is required').max(100),
  fileName: z.string().min(1, 'File name is required').max(255),
  contentType: AllowedMimeTypeEnum,
  fileSizeBytes: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be greater than zero')
    .max(
      MEDIA_CONSTRAINTS.MAX_DOCUMENT_SIZE_BYTES,
      `File size cannot exceed ${MEDIA_CONSTRAINTS.MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)} MB`
    ),
});
export type RequestPresignedUploadUrlInput = z.infer<typeof RequestPresignedUploadUrlSchema>;

export const PresignedUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileUrl: z.string().url(),
  storageKey: z.string().min(1),
  purpose: z.string(),
  entityId: z.string(),
  expiresInSeconds: z.number().int().positive(),
  headers: z.record(z.string()),
});
export type PresignedUploadUrlResponse = z.infer<typeof PresignedUploadUrlResponseSchema>;

export const ConfirmMediaAttachmentSchema = z.object({
  storageKey: z.string().min(1, 'Storage key is required'),
  fileUrl: z.string().url('File URL must be a valid URL'),
  purpose: MediaPurposeEnum,
  entityId: z.string().min(1, 'Entity ID is required'),
  caption: z.string().trim().max(255, 'Caption cannot exceed 255 characters').optional(),
  contentType: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
});
export type ConfirmMediaAttachmentInput = z.infer<typeof ConfirmMediaAttachmentSchema>;

export const MediaAttachmentResponseSchema = z.object({
  id: z.string(),
  storageKey: z.string(),
  fileUrl: z.string().url(),
  purpose: z.string(),
  entityId: z.string(),
  uploaderUserId: z.string(),
  uploaderRole: z.string(),
  caption: z.string().nullable().optional(),
  contentType: z.string(),
  fileSizeBytes: z.number().int(),
  createdAt: z.string(),
});
export type MediaAttachmentResponse = z.infer<typeof MediaAttachmentResponseSchema>;

export const BookingMediaListResponseSchema = z.object({
  bookingId: z.string(),
  problemPhotos: z.array(MediaAttachmentResponseSchema),
  beforeWorkPhotos: z.array(MediaAttachmentResponseSchema),
  afterWorkPhotos: z.array(MediaAttachmentResponseSchema),
  otherAttachments: z.array(MediaAttachmentResponseSchema),
  totalCount: z.number().int(),
});
export type BookingMediaListResponse = z.infer<typeof BookingMediaListResponseSchema>;
