import { FastifyRequest, FastifyReply } from 'fastify';
import { AiService, FrameAnalysisRequest } from './ai.service.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';

export class AiChatController {
  static async analyzeFrame(
    request: FastifyRequest<{ Body: FrameAnalysisRequest }>,
    reply: FastifyReply
  ) {
    const { imageBase64 } = request.body;

    if (!imageBase64) {
      throw AppError.badRequest('imageBase64 frame data is required');
    }

    const result = await AiService.analyzeFrame(request.body);

    return sendSuccess(reply, {
      message: 'Frame analyzed successfully',
      data: result,
    });
  }

  static async generateEmbedding(
    request: FastifyRequest<{ Body: { text: string } }>,
    reply: FastifyReply
  ) {
    const { text } = request.body;

    if (!text || !text.trim()) {
      throw AppError.badRequest('text field is required for embedding generation');
    }

    const embedding = await AiService.generateEmbedding(text);

    return sendSuccess(reply, {
      message: 'Vector embedding generated',
      data: {
        embedding,
        dimension: embedding.length,
      },
    });
  }
}
