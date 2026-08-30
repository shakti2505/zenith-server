import { FastifyPluginAsync } from 'fastify';
import { SessionController } from './session.controller.js';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/start', SessionController.startSession);
  fastify.get('/:id', SessionController.getSessionById);
};
