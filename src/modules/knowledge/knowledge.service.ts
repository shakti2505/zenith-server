import mongoose from 'mongoose';
import { KnowledgeChunkModel, IKnowledgeChunk, IKnowledgeChunkMetadata } from './knowledge.model.js';

export class KnowledgeService {
  static async createChunk(data: {
    content: string;
    assetId: string;
    embedding: number[];
    metadata?: IKnowledgeChunkMetadata;
    chunkIndex?: number;
  }): Promise<IKnowledgeChunk> {
    const chunk = new KnowledgeChunkModel(data);
    return await chunk.save();
  }

  static async getChunksByAssetId(assetId: string, limit: number = 20): Promise<IKnowledgeChunk[]> {
    return await KnowledgeChunkModel.find({ assetId }).sort({ chunkIndex: 1 }).limit(limit).exec();
  }

  static async vectorSearch(params: {
    queryEmbedding: number[];
    assetId?: string;
    limit?: number;
    numCandidates?: number;
  }): Promise<Array<IKnowledgeChunk & { score?: number }>> {
    const limit = params.limit || 5;
    const numCandidates = params.numCandidates || limit * 10;

    try {
      // Atlas Vector Search Pipeline
      const pipeline: mongoose.PipelineStage[] = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: params.queryEmbedding,
            numCandidates: numCandidates,
            limit: limit,
            filter: params.assetId ? { assetId: params.assetId } : undefined,
          },
        },
        {
          $project: {
            content: 1,
            assetId: 1,
            metadata: 1,
            chunkIndex: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      return await KnowledgeChunkModel.aggregate(pipeline).exec();
    } catch {
      // Fallback query if vector index is not available in local MongoDB instance
      const query: Record<string, unknown> = {};
      if (params.assetId) query.assetId = params.assetId;

      return await KnowledgeChunkModel.find(query).limit(limit).exec();
    }
  }

  static async deleteChunk(id: string): Promise<boolean> {
    const result = await KnowledgeChunkModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
