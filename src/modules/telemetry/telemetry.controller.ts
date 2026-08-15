import { FastifyRequest, FastifyReply } from 'fastify';
import { TelemetryService } from './telemetry.service.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';

export class TelemetryController {
  static async getTelemetry(
    request: FastifyRequest<{
      Querystring: {
        assetId?: string;
        workOrderId?: string;
        startDate?: string;
        endDate?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { assetId, workOrderId, startDate, endDate, limit } = request.query;

    const entries = await TelemetryService.getTelemetry({
      assetId,
      workOrderId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    return sendSuccess(reply, {
      message: 'Telemetry records retrieved successfully',
      data: entries,
      meta: { count: entries.length },
    });
  }

  static async getStats(
    request: FastifyRequest<{ Querystring: { assetId?: string } }>,
    reply: FastifyReply
  ) {
    const { assetId } = request.query;
    const stats = await TelemetryService.getStats(assetId);

    return sendSuccess(reply, {
      message: 'Telemetry aggregate stats calculated',
      data: stats,
    });
  }

  static async recordTelemetry(
    request: FastifyRequest<{
      Body: {
        confidenceScore: number;
        latencyMs: number;
        metadata: {
          assetId: string;
          workOrderId?: string;
          workerId?: string;
          modelName?: string;
          stepId?: string;
        };
        status?: 'success' | 'warning' | 'error';
        details?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply
  ) {
    const { confidenceScore, latencyMs, metadata, status, details } = request.body;

    if (confidenceScore === undefined || latencyMs === undefined || !metadata?.assetId) {
      throw AppError.badRequest('confidenceScore, latencyMs, and metadata.assetId are required');
    }

    if (confidenceScore < 0 || confidenceScore > 1) {
      throw AppError.badRequest('confidenceScore must be between 0.0 and 1.0');
    }

    const telemetry = await TelemetryService.recordTelemetry({
      confidenceScore,
      latencyMs,
      metadata,
      status,
      details,
    });

    return sendSuccess(reply, {
      statusCode: 201,
      message: 'Telemetry record created successfully',
      data: telemetry,
    });
  }
}
