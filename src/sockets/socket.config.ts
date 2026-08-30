import { ServerOptions } from 'socket.io';

export const SOCKET_IO_CONFIG: Partial<ServerOptions> = {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 10000,        // Heartbeat ping every 10 seconds
  pingTimeout: 20000,         // Client timeout after 20 seconds
  maxHttpBufferSize: 15 * 1024 * 1024, // 15MB binary frame buffer limit
  transports: ['websocket', 'polling'],
};

export const SOCKET_EVENTS = {
  // Client -> Server events
  PROCESS_FRAME: 'process_frame',
  JOIN_STREAM: 'join_stream',
  LEAVE_STREAM: 'leave_stream',
  VIDEO_FRAME: 'video_frame',
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_ACK: 'heartbeat_ack',

  // Server -> Client events
  FRAME_PROCESSED: 'frame_processed',
  AI_RESPONSE: 'ai_response',
  AI_VERDICT: 'ai_verdict',
  PAUSE_LOOP: 'pause_loop',
  FRAME_QUEUED: 'frame_queued',
  STREAM_STATUS: 'stream_status',
  ERROR: 'error',
} as const;

export type ClientRole = 'publisher' | 'subscriber' | 'worker';

export interface SocketData {
  workOrderId?: string;
  role?: ClientRole;
  workerName?: string;
  connectedAt?: number;
}

export interface JoinStreamPayload {
  workOrderId: string;
  role: ClientRole;
  workerName?: string;
}

export interface VideoFramePayload {
  workOrderId: string;
  data: string; // base64 video frame payload
  stepNumber?: number;
  workerName?: string;
  timestamp?: string;
  clientTimestamp?: number;
}

export interface StreamStatusPayload {
  workOrderId: string;
  status: 'active' | 'idle' | 'disconnected';
  publishersCount: number;
  subscribersCount: number;
  timestamp: string;
}
