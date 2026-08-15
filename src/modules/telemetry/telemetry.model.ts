import { Schema, model, Document } from 'mongoose';

export interface ITelemetryMetadata {
  assetId: string;
  workOrderId?: string;
  workerId?: string;
  modelName?: string;
  stepId?: string;
  [key: string]: unknown;
}

export interface ITelemetry extends Document {
  timestamp: Date;
  metadata: ITelemetryMetadata;
  confidenceScore: number; // 0.0 to 1.0 AI confidence score
  latencyMs: number;       // Latency in milliseconds
  status: 'success' | 'warning' | 'error';
  details?: Record<string, unknown>;
}

const TelemetrySchema = new Schema<ITelemetry>(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      assetId: { type: String, required: true },
      workOrderId: { type: String },
      workerId: { type: String },
      modelName: { type: String, default: 'industrial-ai-v1' },
      stepId: { type: String },
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    latencyMs: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'error'],
      default: 'success',
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timeseries: {
      timeField: 'timestamp',
      metaField: 'metadata',
      granularity: 'seconds',
    },
  }
);

export const TelemetryModel = model<ITelemetry>('Telemetry', TelemetrySchema);
