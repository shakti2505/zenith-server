import { FastifyPluginAsync } from 'fastify';
import { KnowledgeController } from './knowledge.controller.js';

export const knowledgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', KnowledgeController.createChunk);
  fastify.get('/asset/:assetId', KnowledgeController.getChunksByAssetId);
  fastify.post('/vector-search', KnowledgeController.vectorSearch);
  fastify.delete('/:id', KnowledgeController.deleteChunk);
};
