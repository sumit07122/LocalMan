import { z } from 'zod';
import { BookingStatus, PricingModel } from '@localman/constants';

export const CreateBookingSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  providerId: z.string().optional(), // Optional, backward compatibility
  addressId: z.string().min(1, 'Address ID is required'),
  jobDescription: z.string().min(10, 'Job description must be at least 10 characters').max(1000).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  scheduledTimeSlot: z.string().min(1, 'Time slot is required (e.g. 10:00 AM - 12:00 PM)'),
  pricingModel: z.enum([
    PricingModel.HOURLY,
    PricingModel.FIXED_PRICE,
    PricingModel.INSPECTION_QUOTE,
    PricingModel.CUSTOM_QUOTE,
  ]),
  hours: z.number().int().min(1).max(24).optional(), // For HOURLY pricing model
  customerNotes: z.string().max(500).optional(),
  attachments: z.array(z.string()).max(5).optional(),
  idempotencyKey: z.string().max(100).optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const BookingAddressSnapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  landmark: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});
export type BookingAddressSnapshot = z.infer<typeof BookingAddressSnapshotSchema>;

export const BookingPricingSnapshotSchema = z.object({
  pricingModel: z.string(),
  basePricePaisa: z.number().int(),
  hourlyRatePaisa: z.number().int().nullable().optional(),
  inspectionFeePaisa: z.number().int().nullable().optional(),
  requestedHours: z.number().nullable().optional(),
  taxRatePercent: z.number(),
  isQuoteRequired: z.boolean(),
});
export type BookingPricingSnapshot = z.infer<typeof BookingPricingSnapshotSchema>;

export const BookingServiceSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  estimatedDurationMinutes: z.number(),
});
export type BookingServiceSnapshot = z.infer<typeof BookingServiceSnapshotSchema>;

export const AssignedProviderPublicSchema = z.object({
  id: z.string(),
  businessName: z.string().nullable().optional(),
  fullName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  ratingAverage: z.number(),
  ratingCount: z.number().int(),
  experienceYears: z.number().int(),
});
export type AssignedProviderPublic = z.infer<typeof AssignedProviderPublicSchema>;

export const BookingTimelineItemSchema = z.object({
  id: z.string(),
  fromState: z.string().nullable().optional(),
  toState: z.string(),
  actorRole: z.string(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type BookingTimelineItem = z.infer<typeof BookingTimelineItemSchema>;

export const BookingDispatchStatusSchema = z.object({
  isSearching: z.boolean(),
  attemptNumber: z.number().int(),
  hasActiveOffer: z.boolean(),
  expiresAt: z.string().nullable().optional(),
  assignedProviderId: z.string().nullable().optional(),
});
export type BookingDispatchStatus = z.infer<typeof BookingDispatchStatusSchema>;

export const BookingResponseSchema = z.object({
  id: z.string(),
  bookingNumber: z.string(),
  customerId: z.string(),
  providerId: z.string().nullable().optional(),
  serviceId: z.string(),
  addressId: z.string(),
  currentStatus: z.string(),
  pricingModel: z.string(),
  scheduledDate: z.string(),
  scheduledTimeSlot: z.string(),
  startOtp: z.string().optional(),
  jobDescription: z.string().nullable().optional(),
  customerNotes: z.string().nullable().optional(),
  baseAmountPaisa: z.number().int(),
  taxAmountPaisa: z.number().int(),
  materialsTotalPaisa: z.number().int().optional(),
  totalAmountPaisa: z.number().int(),
  addressSnapshot: BookingAddressSnapshotSchema.nullable().optional(),
  pricingSnapshot: BookingPricingSnapshotSchema.nullable().optional(),
  serviceSnapshot: BookingServiceSnapshotSchema.nullable().optional(),
  attachments: z.array(z.string()).nullable().optional(),
  assignedProvider: AssignedProviderPublicSchema.nullable().optional(),
  timeline: z.array(BookingTimelineItemSchema).optional(),
  dispatchStatus: BookingDispatchStatusSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;

export const BookingListResponseSchema = z.object({
  items: z.array(BookingResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;

export const UpdateBookingStatusSchema = z.object({
  status: z.enum([
    BookingStatus.PROVIDER_ACCEPTED,
    BookingStatus.CONFIRMED,
    BookingStatus.PROVIDER_ON_THE_WAY,
    BookingStatus.ARRIVED,
    BookingStatus.JOB_STARTED,
    BookingStatus.JOB_EXTENDED,
    BookingStatus.JOB_COMPLETED,
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.PAYMENT_SETTLED,
    BookingStatus.REVIEWED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
    BookingStatus.DISPUTED,
    BookingStatus.REFUNDED,
    BookingStatus.EXPIRED,
  ]),
  reason: z.string().optional(),
  startOtp: z.string().length(6).optional(), // Required when transitioning to JOB_STARTED
  completionPhotos: z.array(z.string().url()).optional(), // Required for JOB_COMPLETED
});
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;

export const AddBookingMaterialSchema = z.object({
  itemName: z.string().min(2).max(150),
  quantity: z.number().min(0.1).default(1),
  unitPricePaisa: z.number().int().min(1),
  receiptPhotoUrl: z.string().url().optional(),
});
export type AddBookingMaterialInput = z.infer<typeof AddBookingMaterialSchema>;

export const ApproveBookingMaterialSchema = z.object({
  materialId: z.string().min(1),
  approved: z.boolean(),
});
export type ApproveBookingMaterialInput = z.infer<typeof ApproveBookingMaterialSchema>;
