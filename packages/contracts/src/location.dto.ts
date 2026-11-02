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
  bookingId: z.string().min(1).max(100).optional(),
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

// ============================================================================
// Phase 3K: Live Maps & ETA Contracts
// ============================================================================

export const LiveMapStateEnum = z.enum([
  'SEARCHING',
  'PROVIDER_ASSIGNED_LOCATION_UNAVAILABLE',
  'PROVIDER_ON_THE_WAY',
  'PROVIDER_NEAR_DESTINATION',
  'PROVIDER_ARRIVED',
  'TRACKING_STOPPED_JOB_STARTED',
  'LOCATION_STALE',
  'LOCATION_UNAVAILABLE',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
]);
export type LiveMapState = z.infer<typeof LiveMapStateEnum>;

export const DestinationAddressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  landmark: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});
export type DestinationAddress = z.infer<typeof DestinationAddressSchema>;

export const MapProviderSummarySchema = z.object({
  id: z.string(),
  businessName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  ratingAverage: z.number().optional(),
  experienceYears: z.number().optional(),
});
export type MapProviderSummary = z.infer<typeof MapProviderSummarySchema>;

export const LiveRouteSchema = z.object({
  distanceMeters: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  etaMinutes: z.number().nullable().optional(),
  isRealTimeRouting: z.boolean(),
  status: z.string(),
});
export type LiveRoute = z.infer<typeof LiveRouteSchema>;

export const LiveMapStateResponseSchema = z.object({
  bookingId: z.string(),
  bookingStatus: z.string(),
  mapState: LiveMapStateEnum,
  isTrackingPermitted: z.boolean(),
  isNearDestination: z.boolean(),
  nearDestinationThresholdMeters: z.number(),
  destination: DestinationAddressSchema.nullable().optional(),
  provider: MapProviderSummarySchema.nullable().optional(),
  providerLocation: z
    .object({
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      heading: z.number().nullable().optional(),
      speed: z.number().nullable().optional(),
      accuracy: z.number().nullable().optional(),
      lastLocationAt: z.string().nullable().optional(),
      freshnessStatus: LocationFreshnessStatusEnum,
    })
    .nullable()
    .optional(),
  route: LiveRouteSchema.nullable().optional(),
  timestamp: z.string(),
});
export type LiveMapStateResponse = z.infer<typeof LiveMapStateResponseSchema>;

export const BookingEtaResponseSchema = z.object({
  bookingId: z.string(),
  bookingStatus: z.string(),
  isTrackingPermitted: z.boolean(),
  isNearDestination: z.boolean(),
  distanceMeters: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  etaMinutes: z.number().nullable().optional(),
  isRealTimeRouting: z.boolean(),
  routingStatus: z.string(),
  freshnessStatus: LocationFreshnessStatusEnum,
  timestamp: z.string(),
});
export type BookingEtaResponse = z.infer<typeof BookingEtaResponseSchema>;
