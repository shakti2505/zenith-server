import { FastifyRequest, FastifyReply } from 'fastify';
import { TelemetryService } from './telemetry.service.js';
import { liveFrameStore, LiveFrameData } from './live-frame.store.js';
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

  // Retrieve latest live camera frame for a work order
  static async getLiveFrame(
    request: FastifyRequest<{ Params: { workOrderId: string } }>,
    reply: FastifyReply
  ) {
    const { workOrderId } = request.params;
    if (!workOrderId) {
      throw AppError.badRequest('workOrderId parameter is required');
    }

    const frame = liveFrameStore.getFrame(workOrderId);
    if (!frame) {
      return sendSuccess(reply, {
        message: 'No active live frame received yet for this work order',
        data: null,
      });
    }

    const ageMs = Date.now() - frame.receivedAt;
    return sendSuccess(reply, {
      message: 'Latest live frame retrieved',
      data: {
        ...frame,
        ageMs,
        isLive: ageMs < 10000, // Considered active stream if frame arrived in last 10s
      },
    });
  }

  // Real-Time Server-Sent Events (SSE) Stream for sub-10ms latency live video
  static streamLiveFrames(
    request: FastifyRequest<{ Params: { workOrderId: string } }>,
    reply: FastifyReply
  ) {
    const { workOrderId } = request.params;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    // Send initial cached frame if present
    const initial = liveFrameStore.getFrame(workOrderId);
    if (initial) {
      reply.raw.write(`data: ${JSON.stringify(initial)}\n\n`);
    }

    const onFrame = (frame: LiveFrameData) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(frame)}\n\n`);
      } catch (err) {
        // socket closed
      }
    };

    const specificEvent = `frame:${workOrderId}`;
    liveFrameStore.on(specificEvent, onFrame);
    liveFrameStore.on('frame:global', onFrame);

    request.raw.on('close', () => {
      liveFrameStore.off(specificEvent, onFrame);
      liveFrameStore.off('frame:global', onFrame);
    });
  }

  // Upload a live frame directly from mobile app
  static async postLiveFrame(
    request: FastifyRequest<{
      Body: {
        workOrderId: string;
        stepNumber?: number;
        imageBase64: string;
        workerName?: string;
        assetId?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { workOrderId, stepNumber, imageBase64, workerName, assetId } = request.body;

    if (!workOrderId || !imageBase64) {
      throw AppError.badRequest('workOrderId and imageBase64 are required');
    }

    const frameData: LiveFrameData = {
      workOrderId,
      stepNumber: stepNumber || 1,
      imageBase64,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),
      workerName,
      assetId,
    };

    liveFrameStore.setFrame(workOrderId, frameData);

    return sendSuccess(reply, {
      message: 'Live frame received and published for supervisor monitor',
      data: {
        workOrderId,
        receivedAt: frameData.receivedAt,
      },
    });
  }
}
