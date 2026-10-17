import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully shutting down...`);
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

start();
