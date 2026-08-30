/**
 * Strictly Typed Vision Job & WebSocket Payload Interfaces
 */

export interface VisionJobData {
  socketId: string;
  frameBuffer: Buffer | string; // Binary Buffer or base64 string
  workOrderId?: string;
  stepNumber?: number;
  workerName?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface VisionResultPayload {
  status: 'COMPLETED' | 'IN_PROGRESS' | 'HAZARD' | 'INVALID_VIEW' | 'IMAGE_UNCLEAR' | 'FAILED' | 'PROCESSING';
  feedback_hinglish: string;
  jobId?: string;
  workOrderId?: string;
  stepNumber?: number;
  current_step_index?: number;
  total_steps?: number;
  next_step_text?: string;
  confidence?: number;
  processingTimeMs?: number;
  timestamp: string;
  isRoomBroadcast?: boolean;
}

export type RawFrameBuffer = ArrayBuffer | Buffer | Uint8Array;

export interface FrameMetadataPayload {
  workOrderId?: string;
  stepNumber?: number;
  workerName?: string;
  timestamp?: string;
  frame?: RawFrameBuffer;
}

export type ProcessFrameInput = RawFrameBuffer | FrameMetadataPayload;
