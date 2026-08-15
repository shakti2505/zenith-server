import { FastifyPluginAsync } from 'fastify';
import { AiChatController } from './ai-chat.controller.js';

export const aiChatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/analyze-frame', AiChatController.analyzeFrame);
  fastify.post('/embed', AiChatController.generateEmbedding);
};
