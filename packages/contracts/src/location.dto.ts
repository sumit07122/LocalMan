import { z } from 'zod';

export const LocationUpdateSchema = z.object({
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  accuracy: z
    .number()
    .positive('Accuracy must be positive')
    .max(5000, 'Accuracy must be <= 5000m')
    .optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(75, 'Speed must be <= 75 m/s (~270 km/h)').optional(),
  timestamp: z.union([z.string().datetime(), z.number()]).optional(),
  source: z.string().max(50).optional().default('FOREGROUND_APP'),
  bookingId: z.string().uuid().optional(),
});
export type LocationUpdateInput = z.infer<typeof LocationUpdateSchema>;

export const LocationFreshnessStatusEnum = z.enum([
  'FRESH',
  'STALE',
  'UNAVAILABLE',
]);
export type LocationFreshnessStatus = z.infer<typeof LocationFreshnessStatusEnum>;

export const ProviderOperationalStatusEnum = z.enum([
  'OFFLINE',
  'ONLINE',
  'ONLINE_BUT_LOCATION_STALE',
  'BUSY',
]);
export type ProviderOperationalStatus = z.infer<typeof ProviderOperationalStatusEnum>;

export const ProviderLocationResponseSchema = z.object({
  providerId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  lastLocationAt: z.string().nullable().optional(),
  freshnessStatus: LocationFreshnessStatusEnum,
  isOnline: z.boolean(),
  operationalStatus: ProviderOperationalStatusEnum,
});
export type ProviderLocationResponse = z.infer<typeof ProviderLocationResponseSchema>;

export const CustomerTrackingLocationResponseSchema = z.object({
  bookingId: z.string(),
  providerId: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  lastLocationAt: z.string().nullable().optional(),
  freshnessStatus: LocationFreshnessStatusEnum,
  etaMinutes: z.number().nullable().optional(),
  distanceMeters: z.number().nullable().optional(),
  isRealTimeRouting: z.boolean(),
});
export type CustomerTrackingLocationResponse = z.infer<typeof CustomerTrackingLocationResponseSchema>;

export const ServiceAreaCheckSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});
export type ServiceAreaCheckInput = z.infer<typeof ServiceAreaCheckSchema>;
