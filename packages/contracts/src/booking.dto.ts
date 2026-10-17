import { z } from 'zod';
import { BookingStatus, PricingModel } from '@localman/constants';

export const CreateBookingSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  providerId: z.string().optional(), // Optional if system auto-dispatches to nearest verified provider
  addressId: z.string().min(1, 'Address ID is required'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  scheduledTimeSlot: z.string().min(1, 'Time slot is required (e.g. 10:00 AM - 12:00 PM)'),
  pricingModel: z.enum([
    PricingModel.HOURLY,
    PricingModel.FIXED_PRICE,
    PricingModel.INSPECTION_QUOTE,
    PricingModel.CUSTOM_QUOTE,
  ]),
  customerNotes: z.string().max(500).optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

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

export const SubmitQuoteSchema = z.object({
  quoteAmountPaisa: z.number().int().min(100),
  breakdownNotes: z.string().min(5),
  estimatedHours: z.number().min(0.5).max(100).optional(),
});
export type SubmitQuoteInput = z.infer<typeof SubmitQuoteSchema>;
