import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { globalErrorHandler } from './common/errors/error-handler.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { catalogRoutes, categoryRoutes, serviceRoutes } from './modules/catalog/catalog.routes.js';
import { bookingRoutes } from './modules/bookings/booking.routes.js';
import { providerRoutes } from './modules/providers/provider.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { addressRoutes } from './modules/addresses/address.routes.js';
import { reviewRoutes } from './modules/reviews/review.routes.js';
import { reviewController } from './modules/reviews/review.controller.js';
import { mediaRoutes } from './modules/media/media.routes.js';

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

  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (such as mobile applications, curl, server-to-server)
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }
      cb(new Error(`Origin ${origin} not allowed by LocalMan CORS policy`), false);
    },
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

  // Health Checks: Liveness, Readiness, and Legacy
  app.get('/health/live', async () => {
    return {
      status: 'ok',
      service: 'localman-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/health/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'localman-api',
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      request.log.error(err, 'Database readiness check failed');
      return reply.status(503).send({
        status: 'error',
        service: 'localman-api',
        database: 'disconnected',
        message: 'Database connection check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

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
      await api.register(addressRoutes, { prefix: '/addresses' });
      await api.register(categoryRoutes, { prefix: '/categories' });
      await api.register(serviceRoutes, { prefix: '/services' });
      await api.register(reviewRoutes, { prefix: '/reviews' });
      await api.register(mediaRoutes, { prefix: '/media' });

      // Public Provider Reviews & Reputation routes
      api.get('/providers/:providerId/reviews', reviewController.getProviderReviews);
      api.get('/providers/:providerId/reputation', reviewController.getProviderReputation);
    },
    { prefix: env.API_PREFIX }
  );

  return app;
}
