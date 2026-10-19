import { z } from 'zod';

export const CreateAddressSchema = z.object({
  label: z.string().min(1, 'Label is required').max(50).default('Home'),
  addressLine1: z.string().min(3, 'Address line 1 must be at least 3 characters').max(255),
  addressLine2: z.string().max(255).optional().nullable(),
  landmark: z.string().max(100).optional().nullable(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  postalCode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, 'Postal code must be a valid 6-digit Indian PIN code'),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  isDefault: z.boolean().optional().default(false),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;

export const UpdateAddressSchema = CreateAddressSchema.partial();
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;

export const AddressResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  label: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  landmark: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AddressResponse = z.infer<typeof AddressResponseSchema>;
