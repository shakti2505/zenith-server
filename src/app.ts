import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import { envOptions } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { globalErrorHandler } from './utils/errorHandler.js';
import { workOrderRoutes } from './modules/work-order/work-order.routes.js';
import { telemetryRoutes } from './modules/telemetry/telemetry.routes.js';
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes.js';
import { rtcRoutes } from './modules/rtc/rtc.routes.js';
import { aiChatRoutes } from './modules/ai-chat/ai-chat.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register Environment configuration plugin
  await fastify.register(fastifyEnv, envOptions);

  // Register CORS
  await fastify.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Register Global Error Handler
  fastify.setErrorHandler(globalErrorHandler);

  // Connect to MongoDB using Mongoose
  try {
    await connectDatabase(fastify);
  } catch (err) {
    fastify.log.warn(`[Database] Continuing without active MongoDB connection: ${err}`);
  }

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'industrial-ai-copilot-backend',
      timestamp: new Date().toISOString(),
    };
  });

  // Register Modular API Routes
  await fastify.register(workOrderRoutes, { prefix: '/api/work-orders' });
  await fastify.register(telemetryRoutes, { prefix: '/api/telemetry' });
  await fastify.register(knowledgeRoutes, { prefix: '/api/knowledge' });
  await fastify.register(rtcRoutes, { prefix: '/api/rtc' });
  await fastify.register(aiChatRoutes, { prefix: '/api/ai-chat' });

  return fastify;
}
