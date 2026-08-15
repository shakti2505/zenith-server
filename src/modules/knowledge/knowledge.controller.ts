import { FastifyRequest, FastifyReply } from 'fastify';
import { KnowledgeService } from './knowledge.service.js';
import { IKnowledgeChunkMetadata } from './knowledge.model.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';

export class KnowledgeController {
  static async createChunk(
    request: FastifyRequest<{
      Body: {
        content: string;
        assetId: string;
        embedding: number[];
        metadata?: IKnowledgeChunkMetadata;
        chunkIndex?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    const { content, assetId, embedding, metadata, chunkIndex } = request.body;

    if (!content || !assetId || !embedding) {
      throw AppError.badRequest('content, assetId, and embedding are required fields');
    }

    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      throw AppError.badRequest(
        `embedding must be a 1536-dimensional array of floats (received length: ${embedding?.length || 0})`
      );
    }

    const chunk = await KnowledgeService.createChunk({
      content,
      assetId,
      embedding,
      metadata,
      chunkIndex,
    });

    return sendSuccess(reply, {
      statusCode: 201,
      message: 'Knowledge chunk stored successfully',
      data: chunk,
    });
  }

  static async getChunksByAssetId(
    request: FastifyRequest<{
      Params: { assetId: string };
      Querystring: { limit?: string };
    }>,
    reply: FastifyReply
  ) {
    const { assetId } = request.params;
    const { limit } = request.query;

    const chunks = await KnowledgeService.getChunksByAssetId(assetId, limit ? parseInt(limit, 10) : 20);

    return sendSuccess(reply, {
      message: `Knowledge chunks for asset ${assetId} retrieved`,
      data: chunks,
      meta: { count: chunks.length },
    });
  }

  static async vectorSearch(
    request: FastifyRequest<{
      Body: {
        queryEmbedding: number[];
        assetId?: string;
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    const { queryEmbedding, assetId, limit } = request.body;

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
      throw AppError.badRequest('queryEmbedding must be a 1536-dimensional array of floats');
    }

    const results = await KnowledgeService.vectorSearch({
      queryEmbedding,
      assetId,
      limit,
    });

    return sendSuccess(reply, {
      message: 'Vector search completed successfully',
      data: results,
      meta: { count: results.length },
    });
  }

  static async deleteChunk(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const deleted = await KnowledgeService.deleteChunk(id);

    if (!deleted) {
      throw AppError.notFound(`Knowledge chunk with ID ${id} not found`);
    }

    return sendSuccess(reply, {
      message: 'Knowledge chunk deleted successfully',
      data: { id },
    });
  }
}
