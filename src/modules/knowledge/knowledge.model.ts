import { Schema, model, Document } from 'mongoose';

export interface IKnowledgeChunkMetadata {
  documentTitle?: string;
  sourceUrl?: string;
  section?: string;
  pageNumber?: number;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface IKnowledgeChunk extends Document {
  content: string;
  assetId: string;
  embedding: number[]; // 1536-dimensional array for OpenAI / Atlas Vector Search
  metadata?: IKnowledgeChunkMetadata;
  chunkIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    assetId: {
      type: String,
      required: true,
      index: true,
    },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: function (val: number[]) {
          // Validate 1536-dimensional embedding array
          return Array.isArray(val) && val.length === 1536;
        },
        message: 'Embedding vector must be a 1536-dimensional array of numbers',
      },
    },
    metadata: {
      documentTitle: { type: String },
      sourceUrl: { type: String },
      section: { type: String },
      pageNumber: { type: Number },
      category: { type: String },
      tags: [{ type: String }],
    },
    chunkIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Standard index for asset lookup
KnowledgeChunkSchema.index({ assetId: 1, chunkIndex: 1 });

/**
 * Note for MongoDB Atlas Vector Search Index Configuration:
 * To use Atlas Vector Search on this collection, create a Vector Search Index in MongoDB Atlas:
 * Index Name: "vector_index"
 * Definition:
 * {
 *   "fields": [
 *     {
 *       "type": "vector",
 *       "path": "embedding",
 *       "numDimensions": 1536,
 *       "similarity": "cosine"
 *     },
 *     {
 *       "type": "filter",
 *       "path": "assetId"
 *     }
 *   ]
 * }
 */

export const KnowledgeChunkModel = model<IKnowledgeChunk>('KnowledgeChunk', KnowledgeChunkSchema);
