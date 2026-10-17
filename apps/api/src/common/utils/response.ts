import { FastifyReply } from 'fastify';
import { ApiResponse } from '@localman/contracts';

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  meta?: { page?: number; limit?: number; total?: number }
) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  };
  return reply.status(statusCode).send(response);
}
