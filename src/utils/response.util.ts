import { FastifyReply } from 'fastify';

export interface ApiResponseOptions<T = unknown> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorOptions {
  statusCode?: number;
  message: string;
  details?: unknown;
}

export function sendSuccess<T = unknown>(reply: FastifyReply, options: ApiResponseOptions<T> = {}): FastifyReply {
  const statusCode = options.statusCode || 200;
  const message = options.message || 'Success';

  return reply.status(statusCode).send({
    success: true,
    statusCode,
    message,
    data: options.data !== undefined ? options.data : null,
    ...(options.meta ? { meta: options.meta } : {}),
  });
}

export function sendError(reply: FastifyReply, options: ApiErrorOptions): FastifyReply {
  const statusCode = options.statusCode || 500;

  return reply.status(statusCode).send({
    success: false,
    statusCode,
    error: options.message,
    ...(options.details !== undefined ? { details: options.details } : {}),
  });
}
