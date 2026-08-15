import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './AppError.js';
import { sendError } from './response.util.js';

export function globalErrorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  // Log all errors
  request.log.error(error);

  // Handle AppError (Known operational error)
  if (error instanceof AppError) {
    return sendError(reply, {
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    });
  }

  // Handle Fastify Validation Error
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation) {
    return sendError(reply, {
      statusCode: 400,
      message: 'Validation failed',
      details: fastifyErr.validation,
    });
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (error.name === 'CastError') {
    return sendError(reply, {
      statusCode: 400,
      message: 'Invalid ID format provided',
    });
  }

  // Handle Mongoose ValidationError
  if (error.name === 'ValidationError') {
    return sendError(reply, {
      statusCode: 400,
      message: error.message,
    });
  }

  // Handle default internal server error
  const isDev = process.env.NODE_ENV !== 'production';
  return sendError(reply, {
    statusCode: fastifyErr.statusCode || 500,
    message: error.message || 'Internal Server Error',
    ...(isDev ? { details: { stack: error.stack } } : {}),
  });
}
