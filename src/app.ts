import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import fastifyMultipart from '@fastify/multipart';
import { envOptions } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { globalErrorHandler } from './utils/errorHandler.js';
import { attachRequestLogger } from './plugins/requestLogger.js';
import { registerBullBoard } from './plugins/bull-board.plugin.js';
import { initSocketGateway, closeSocketGateway } from './sockets/socket.gateway.js';
import { procedureRoutes } from './modules/procedure/procedure.routes.js';
import { sessionRoutes } from './modules/session/session.routes.js';
import { workOrderRoutes } from './modules/work-order/work-order.routes.js';
import { telemetryRoutes } from './modules/telemetry/telemetry.routes.js';
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes.js';
import { aiChatRoutes } from './modules/ai-chat/ai-chat.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    disableRequestLogging: true, // Custom industrial colored logger handles requests
    logger: false,
  });

  // Attach Global Colored Request & Response Logger Hooks
  attachRequestLogger(fastify);

  // Register Environment configuration plugin
  await fastify.register(fastifyEnv, envOptions);

  // Register CORS
  await fastify.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Register Multipart Plugin for SOP Document / Manual Uploads (Max 25MB)
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
    },
  });

  // Register Global Error Handler
  fastify.setErrorHandler(globalErrorHandler);

  // Initialize Real-Time Socket.IO WebSocket Gateway with Redis Adapter
  initSocketGateway(fastify);

  // Clean up Socket.IO gateway and Redis connections on Fastify shutdown
  fastify.addHook('onClose', async () => {
    await closeSocketGateway();
  });

  // Connect to MongoDB using Mongoose
  try {
    await connectDatabase(fastify);
  } catch (err) {
    console.warn(`[Database] Continuing without active MongoDB connection: ${err}`);
  }

  // Register Bull-Board Real-Time Monitoring UI at /admin/queues
  await registerBullBoard(fastify, '/admin/queues');

  // Health check endpoint with gateway & socket status
  fastify.get('/health', async (request) => {
    return {
      status: 'ok',
      service: 'zenith-industrial-ai-copilot-gateway',
      architecture: 'stateless-websocket-redis-bullmq',
      bullBoard: '/admin/queues',
      socketInitialized: !!request.io,
      timestamp: new Date().toISOString(),
    };
  });

  // Register Modular API Routes
  await fastify.register(procedureRoutes, { prefix: '/api/procedures' });
  await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
  await fastify.register(workOrderRoutes, { prefix: '/api/work-orders' });
  await fastify.register(telemetryRoutes, { prefix: '/api/telemetry' });
  await fastify.register(knowledgeRoutes, { prefix: '/api/knowledge' });
  await fastify.register(aiChatRoutes, { prefix: '/api/ai-chat' });

  return fastify;
}
