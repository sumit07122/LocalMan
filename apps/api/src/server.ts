import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

let appInstance: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp();
  app.server.emit('request', req, res);
}

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully shutting down...`);

    // Force exit after 10 seconds if graceful shutdown hangs
    const forceExitTimer = setTimeout(() => {
      app.log.error('Graceful shutdown timed out after 10 seconds. Forcing process exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
      await app.close();
      await prisma.$disconnect();
      app.log.info('Server closed cleanly.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(`🚀 LOCALMAN API server running at: ${address}`);
    app.log.info(`📡 Health Check: ${address}/health`);
    app.log.info(`📚 API Prefix: ${address}${env.API_PREFIX}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// In local execution / non-serverless environments, start the standalone HTTP listener.
// On Vercel, requests are dispatched directly to the exported default handler.
if (!process.env.VERCEL) {
  start();
}

