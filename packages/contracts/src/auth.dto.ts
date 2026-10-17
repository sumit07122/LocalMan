import { z } from 'zod';
import { Roles } from '@localman/constants';

export const SendOtpSchema = z.object({
  phoneCountryCode: z.string().default('+91'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  role: z.enum([Roles.CUSTOMER, Roles.PROVIDER]).default(Roles.CUSTOMER),
});
export type SendOtpInput = z.infer<typeof SendOtpSchema>;

export const VerifyOtpSchema = z.object({
  phoneCountryCode: z.string().default('+91'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  otp: z.string().trim().length(6, 'OTP must be 6 digits'),
  deviceToken: z.string().optional(), // FCM token for push notifications
  role: z.enum([Roles.CUSTOMER, Roles.PROVIDER]).default(Roles.CUSTOMER),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').optional(),
  preferredLanguage: z.string().min(2).max(10).default('en'),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    phoneNumber: z.string(),
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    roles: z.array(z.string()),
    isProfileComplete: z.boolean(),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
