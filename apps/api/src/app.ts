import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env.js';
import { globalErrorHandler } from './common/errors/error-handler.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { bookingRoutes } from './modules/bookings/booking.routes.js';
import { providerRoutes } from './modules/providers/provider.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Security headers & CORS
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(sensible);

  // Rate Limiting (Default 100 req/min per IP)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // JWT Plugin
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Centralized Error Handler
  app.setErrorHandler(globalErrorHandler);

  // Health Check
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'localman-api',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  });

  // Register API Domain Modules under /api/v1
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(catalogRoutes, { prefix: '/catalog' });
      await api.register(bookingRoutes, { prefix: '/bookings' });
      await api.register(providerRoutes, { prefix: '/providers' });
      await api.register(paymentRoutes, { prefix: '/payments' });
      await api.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: env.API_PREFIX }
  );

  return app;
}
