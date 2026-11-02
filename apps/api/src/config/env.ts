import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PREFIX: z.string().default('/api/v1'),

    CORS_ALLOWED_ORIGINS: z
      .string()
      .default(
        'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://localman-admin-web.vercel.app'
      ),

    JWT_SECRET: z
      .string()
      .min(16)
      .default('super_secret_localman_jwt_signing_key_replace_in_prod_2026_xyz'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

    DATABASE_URL: z
      .string()
      .default(
        'postgresql://localman_user:localman_secure_dev_password_2026@localhost:5432/localman_db?schema=public'
      ),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    SMS_GATEWAY_PROVIDER: z.enum(['mock', 'fast2sms', 'msg91', 'twilio']).default('mock'),
    SMS_GATEWAY_API_KEY: z.string().default('mock_key'),
    SMS_SENDER_ID: z.string().default('LCLMAN'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),

    NOTIFICATION_PROVIDER: z.enum(['mock', 'fcm']).default('mock'),
    FCM_PROJECT_ID: z.string().optional(),
    FCM_SERVICE_ACCOUNT_KEY: z.string().optional(),

    PAYMENT_GATEWAY_PROVIDER: z.enum(['mock', 'razorpay', 'cashfree']).default('mock'),
    RAZORPAY_KEY_ID: z.string().default('rzp_test_example'),
    RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_example'),
    RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_example'),

    BOOKING_OTP_PEPPER: z.string().default('localman_secure_booking_otp_pepper_secret_2026'),

    STORAGE_PROVIDER: z.enum(['mock', 's3', 'r2']).default('mock'),
    S3_BUCKET_NAME: z.string().default('localman-documents'),
    S3_REGION: z.string().default('ap-south-1'),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().default('mock_access_key'),
    S3_SECRET_ACCESS_KEY: z.string().default('mock_secret_key'),
    S3_PUBLIC_DOMAIN: z.string().optional(),

    GOOGLE_MAPS_API_KEY: z.string().default('mock_gmaps_key'),
    LOCATION_FRESHNESS_THRESHOLD_SECONDS: z.coerce.number().default(900), // 15 mins
    LOCATION_THROTTLE_SECONDS: z.coerce.number().default(5), // 5 seconds min interval
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        const isDefaultJwt =
          data.JWT_SECRET ===
            'super_secret_localman_jwt_signing_key_replace_in_prod_2026_xyz' ||
          data.JWT_SECRET.length < 32;
        if (isDefaultJwt) return false;

        const isDefaultPepper =
          data.BOOKING_OTP_PEPPER ===
          'localman_secure_booking_otp_pepper_secret_2026';
        if (isDefaultPepper) return false;

        const isDefaultDb = data.DATABASE_URL.includes(
          'localman_secure_dev_password_2026'
        );
        if (isDefaultDb) return false;

        if (data.PAYMENT_GATEWAY_PROVIDER === 'razorpay') {
          if (!data.RAZORPAY_KEY_ID || data.RAZORPAY_KEY_ID === 'rzp_test_example')
            return false;
          if (
            !data.RAZORPAY_KEY_SECRET ||
            data.RAZORPAY_KEY_SECRET === 'rzp_secret_example'
          )
            return false;
        }

        if (data.STORAGE_PROVIDER === 's3') {
          if (
            data.S3_ACCESS_KEY_ID === 'mock_access_key' ||
            data.S3_SECRET_ACCESS_KEY === 'mock_secret_key'
          )
            return false;
        }

        if (data.SMS_GATEWAY_PROVIDER !== 'mock') {
          if (!data.SMS_GATEWAY_API_KEY || data.SMS_GATEWAY_API_KEY === 'mock_key')
            return false;
        }
      }
      return true;
    },
    {
      message:
        'CRITICAL SECURITY ERROR: Production deployment cannot use hardcoded development secrets, weak passwords, or unconfigured cloud provider credentials.',
    }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('================================================================================');
  console.error('❌ FATAL STARTUP ERROR: LocalMan API environment configuration validation failed.');
  console.error('================================================================================');
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || 'CONFIGURATION';
    console.error(` • [${field}]: ${issue.message}`);
  }
  console.error('--------------------------------------------------------------------------------');
  console.error('💡 Remedy: Please copy .env.example to .env and configure all required variables.');
  console.error('================================================================================');
  process.exit(1);
}

export const env = parsed.data;
