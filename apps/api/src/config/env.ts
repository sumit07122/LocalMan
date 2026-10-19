import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PREFIX: z.string().default('/api/v1'),

    JWT_SECRET: z.string().min(16).default('super_secret_localman_jwt_signing_key_replace_in_prod_2026_xyz'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

    DATABASE_URL: z.string().default('postgresql://localman_user:localman_secure_dev_password_2026@localhost:5432/localman_db?schema=public'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    SMS_GATEWAY_PROVIDER: z.enum(['mock', 'fast2sms', 'msg91', 'twilio']).default('mock'),
    SMS_GATEWAY_API_KEY: z.string().default('mock_key'),
    SMS_SENDER_ID: z.string().default('LCLMAN'),

    PAYMENT_GATEWAY_PROVIDER: z.enum(['mock', 'razorpay', 'cashfree']).default('mock'),
    RAZORPAY_KEY_ID: z.string().default('rzp_test_example'),
    RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_example'),
    RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_example'),

    STORAGE_PROVIDER: z.enum(['mock', 's3', 'r2']).default('mock'),
    S3_BUCKET_NAME: z.string().default('localman-documents'),
    S3_REGION: z.string().default('ap-south-1'),

    GOOGLE_MAPS_API_KEY: z.string().default('mock_gmaps_key'),
    LOCATION_FRESHNESS_THRESHOLD_SECONDS: z.coerce.number().default(900), // 15 mins
    LOCATION_THROTTLE_SECONDS: z.coerce.number().default(5), // 5 seconds min interval
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return (
          data.JWT_SECRET !== 'super_secret_localman_jwt_signing_key_replace_in_prod_2026_xyz' &&
          !data.DATABASE_URL.includes('localman_secure_dev_password_2026') &&
          data.RAZORPAY_KEY_SECRET !== 'rzp_secret_example'
        );
      }
      return true;
    },
    {
      message: 'CRITICAL SECURITY ERROR: Production deployment cannot use hardcoded development secrets or fallback passwords.',
    }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
