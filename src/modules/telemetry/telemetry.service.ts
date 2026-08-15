import { TelemetryModel, ITelemetry, ITelemetryMetadata } from './telemetry.model.js';

export class TelemetryService {
  static async recordTelemetry(data: {
    confidenceScore: number;
    latencyMs: number;
    metadata: ITelemetryMetadata;
    status?: 'success' | 'warning' | 'error';
    details?: Record<string, unknown>;
  }): Promise<ITelemetry> {
    const entry = new TelemetryModel({
      timestamp: new Date(),
      confidenceScore: data.confidenceScore,
      latencyMs: data.latencyMs,
      metadata: data.metadata,
      status: data.status || 'success',
      details: data.details,
    });
    return await entry.save();
  }

  static async getTelemetry(filter: {
    assetId?: string;
    workOrderId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};

    if (filter.assetId) {
      query['metadata.assetId'] = filter.assetId;
    }
    if (filter.workOrderId) {
      query['metadata.workOrderId'] = filter.workOrderId;
    }
    if (filter.startDate || filter.endDate) {
      query.timestamp = {};
      if (filter.startDate) (query.timestamp as Record<string, Date>).$gte = filter.startDate;
      if (filter.endDate) (query.timestamp as Record<string, Date>).$lte = filter.endDate;
    }

    const limit = filter.limit || 100;
    return await TelemetryModel.find(query).sort({ timestamp: -1 }).limit(limit).exec();
  }

  static async getStats(assetId?: string) {
    const match: Record<string, unknown> = {};
    if (assetId) {
      match['metadata.assetId'] = assetId;
    }

    const stats = await TelemetryModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgConfidence: { $avg: '$confidenceScore' },
          avgLatency: { $avg: '$latencyMs' },
          minLatency: { $min: '$latencyMs' },
          maxLatency: { $max: '$latencyMs' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    return stats[0] || { avgConfidence: 0, avgLatency: 0, minLatency: 0, maxLatency: 0, totalCount: 0 };
  }
}
