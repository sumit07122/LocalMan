import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const defaultPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const prisma: PrismaClient = new Proxy(defaultPrisma, {
  get(target, prop, receiver) {
    if (globalThis.__prisma) {
      return (globalThis.__prisma as any)[prop];
    }
    return Reflect.get(target, prop, receiver);
  },
});

