import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './AppError.js';
import { sendError } from './response.util.js';
import { colors } from '../plugins/requestLogger.js';

export function globalErrorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const method = request.method;
  const url = request.url;

  // Handle AppError (Known operational error)
  if (error instanceof AppError) {
    const isClientErr = error.statusCode >= 400 && error.statusCode < 500;
    const sign = isClientErr ? '⚠️ [CLIENT ERROR]' : '💥 [OPERATIONAL ERROR]';
    const color = isClientErr ? colors.brightYellow : colors.brightRed;

    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] ${color}${sign} ${colors.bold}${error.statusCode}${colors.reset} on ${colors.bold}${method} ${url}${colors.reset} ➔ ${error.message}`
    );
    if (error.details) {
      console.log(`       ${colors.yellow}↳ Details:${colors.reset} ${colors.gray}${JSON.stringify(error.details)}${colors.reset}`);
    }

    return sendError(reply, {
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    });
  }

  // Handle Fastify Validation Error
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation) {
    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] ${colors.brightYellow}🛑 [VALIDATION FAILED] 400${colors.reset} on ${colors.bold}${method} ${url}${colors.reset} ➔ ${fastifyErr.message}`
    );
    return sendError(reply, {
      statusCode: 400,
      message: 'Validation failed',
      details: fastifyErr.validation,
    });
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (error.name === 'CastError') {
    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] ${colors.brightYellow}⚠️ [INVALID ID FORMAT] 400${colors.reset} on ${colors.bold}${method} ${url}${colors.reset} ➔ ${error.message}`
    );
    return sendError(reply, {
      statusCode: 400,
      message: 'Invalid ID format provided',
    });
  }

  // Handle Mongoose ValidationError
  if (error.name === 'ValidationError') {
    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] ${colors.brightYellow}🛑 [SCHEMA VALIDATION ERROR] 400${colors.reset} on ${colors.bold}${method} ${url}${colors.reset} ➔ ${error.message}`
    );
    return sendError(reply, {
      statusCode: 400,
      message: error.message,
    });
  }

  // Handle Unhandled Internal Server Errors (500)
  console.error(
    `[${colors.gray}${timeStr}${colors.reset}] ${colors.bold}${colors.brightWhite}${colors.bgRed} 💥 [UNHANDLED 500 SERVER ERROR] ${colors.reset} on ${colors.bold}${method} ${url}${colors.reset}\n${colors.brightRed}${error.stack || error.message}${colors.reset}`
  );

  const isDev = process.env.NODE_ENV !== 'production';
  return sendError(reply, {
    statusCode: fastifyErr.statusCode || 500,
    message: error.message || 'Internal Server Error',
    ...(isDev ? { details: { stack: error.stack } } : {}),
  });
}
