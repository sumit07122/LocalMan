import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';

export function globalErrorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // 1. Domain App Errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // 2. Zod Validation Errors
  if (error instanceof ZodError || error.name === 'ZodError' || Array.isArray((error as any).issues)) {
    const zodErr = error as ZodError;
    return reply.status(422).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input parameters',
        details: typeof zodErr.flatten === 'function' ? zodErr.flatten().fieldErrors : (error as any).issues,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // 3. Fastify Validation / Parsing Errors
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || 'BAD_REQUEST',
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // 4. Uncaught Internal Server Errors (500)
  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : error.message,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
