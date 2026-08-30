import { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { getVisionQueue } from '../queues/vision.queue.js';
import { colors } from './requestLogger.js';

/**
 * Register Bull-Board Real-Time Queue Monitoring Dashboard
 * Base Path: /admin/queues
 */
export async function registerBullBoard(
  fastify: FastifyInstance,
  basePath = '/admin/queues'
): Promise<void> {
  // 1. Initialize FastifyAdapter with the base path
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(basePath);

  // 2. Wrap BullMQ queue inside BullMQAdapter
  const visionQueue = getVisionQueue();

  createBullBoard({
    queues: [new BullMQAdapter(visionQueue)],
    serverAdapter,
  });

  // 3. Register Bull-Board router plugin with Fastify
  await fastify.register(serverAdapter.registerPlugin(), {
    prefix: basePath,
  });

  console.log(`  ${colors.brightCyan}📊 Bull-Board Dashboard:${colors.reset} http://0.0.0.0:3000${basePath}`);
}
