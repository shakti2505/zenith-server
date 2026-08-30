import { EventEmitter } from 'events';

export interface LiveFrameData {
  workOrderId: string;
  stepNumber: number;
  imageBase64: string;
  timestamp: string;
  receivedAt: number;
  workerName?: string;
  assetId?: string;
  analysis?: {
    confidenceScore?: number;
    stepVerified?: boolean;
    feedback?: string;
    hazardsDetected?: string[];
  };
}

class LiveFrameStore extends EventEmitter {
  private frames: Map<string, LiveFrameData> = new Map();
  private latestGlobalFrame: LiveFrameData | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  setFrame(key: string, data: LiveFrameData) {
    if (key) this.frames.set(key, data);
    if (data.workOrderId) this.frames.set(data.workOrderId, data);
    if (data.assetId) this.frames.set(data.assetId, data);
    this.latestGlobalFrame = data;

    // Emit live frame event instantly to all SSE / WebSocket subscribers
    this.emit(`frame:${data.workOrderId}`, data);
    if (data.assetId) {
      this.emit(`frame:${data.assetId}`, data);
    }
    this.emit('frame:global', data);
  }

  getFrame(key: string): LiveFrameData | undefined {
    if (!key) return this.latestGlobalFrame || undefined;
    return this.frames.get(key) || this.latestGlobalFrame || undefined;
  }

  getAllFrames(): LiveFrameData[] {
    return Array.from(this.frames.values());
  }

  clear() {
    this.frames.clear();
    this.latestGlobalFrame = null;
  }
}

export const liveFrameStore = new LiveFrameStore();
