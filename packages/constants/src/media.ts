/**
 * LocalMan Media, Object Storage & Attachment Constants (Phase 3L)
 */

export const MediaPurpose = {
  BOOKING_PROBLEM_PHOTO: 'BOOKING_PROBLEM_PHOTO',
  JOB_BEFORE_WORK: 'JOB_BEFORE_WORK',
  JOB_AFTER_WORK: 'JOB_AFTER_WORK',
  REVIEW_PHOTO: 'REVIEW_PHOTO',
  KYC_DOCUMENT: 'KYC_DOCUMENT',
  DISPUTE_EVIDENCE: 'DISPUTE_EVIDENCE',
  CHAT_ATTACHMENT: 'CHAT_ATTACHMENT',
} as const;

export type MediaPurposeType = (typeof MediaPurpose)[keyof typeof MediaPurpose];

export const MEDIA_PURPOSES = Object.values(MediaPurpose);

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
] as const;

export const ALL_ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;

export type AllowedMediaMimeType = (typeof ALL_ALLOWED_MEDIA_MIME_TYPES)[number];

export const MEDIA_CONSTRAINTS = {
  MAX_PHOTO_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_DOCUMENT_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_PHOTOS_PER_REVIEW: 5,
  MAX_BEFORE_PHOTOS_PER_JOB: 5,
  MAX_AFTER_PHOTOS_PER_JOB: 5,
  MAX_PROBLEM_PHOTOS_PER_BOOKING: 5,
  MAX_ATTACHMENTS_PER_BOOKING: 15,
  PRESIGNED_URL_EXPIRY_SECONDS: 900, // 15 minutes
  DEFAULT_STORAGE_BUCKET: 'localman-media-production',
} as const;

export const StorageProviderMode = {
  MOCK: 'mock',
  S3: 's3',
  R2: 'r2',
} as const;

export type StorageProviderModeType = (typeof StorageProviderMode)[keyof typeof StorageProviderMode];
