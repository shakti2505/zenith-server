import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  SOCKET_IO_CONFIG,
  SOCKET_EVENTS,
  SocketData,
  JoinStreamPayload,
  VideoFramePayload,
} from './socket.config.js';
import { createRedisClient } from '../config/redis.js';
import sharp from 'sharp';
import { enqueueVisionFrame, closeVisionQueue } from '../queues/vision.queue.js';
import { liveFrameStore } from '../modules/telemetry/live-frame.store.js';
import { colors } from '../plugins/requestLogger.js';

let ioInstance: Server<any, any, any, SocketData> | null = null;
let pubClient: ReturnType<typeof createRedisClient> | null = null;
let subClient: ReturnType<typeof createRedisClient> | null = null;

/**
 * Handle incoming Socket.IO connection lifecycle & event routing
 */
function handleSocketConnection(socket: Socket<any, any, any, SocketData>) {
  const clientIp = socket.handshake.address || '127.0.0.1';
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  socket.data.connectedAt = Date.now();

  console.log(
    `[${colors.gray}${timeStr}${colors.reset}] 🔌 ${colors.brightGreen}New Socket Connected:${colors.reset} ${colors.yellow}${socket.id}${colors.reset} (${clientIp})`
  );

  // -------------------------------------------------------------
  // 1. Process Frame (Binary ArrayBuffer -> BullMQ Vision Queue)
  // -------------------------------------------------------------
  // Non-blocking: Immediately offload binary frame to BullMQ queue
  socket.on(SOCKET_EVENTS.PROCESS_FRAME, (rawPayload: unknown, ackCallback?: (response: any) => void) => {
    const receiveTimestamp = Date.now();

    // Process asynchronously without blocking the event loop
    setImmediate(async () => {
      try {
        let frameBuffer: Buffer;
        let workOrderId = socket.data.workOrderId;
        let stepNumber = 1;
        let workerName = socket.data.workerName;

        if (Buffer.isBuffer(rawPayload)) {
          // Raw binary Buffer from Node client
          frameBuffer = rawPayload;
        } else if (rawPayload instanceof ArrayBuffer) {
          // Raw binary ArrayBuffer from browser/mobile client
          frameBuffer = Buffer.from(rawPayload);
        } else if (typeof rawPayload === 'string') {
          // Direct base64 string
          const cleanBase64 = rawPayload.replace(/^data:image\/\w+;base64,/, '');
          frameBuffer = Buffer.from(cleanBase64, 'base64');
        } else if (typeof rawPayload === 'object' && rawPayload !== null) {
          // Wrapped payload object with metadata and frame
          const obj = rawPayload as Record<string, any>;
          workOrderId = obj.workOrderId || workOrderId;
          stepNumber = typeof obj.stepNumber === 'number' ? obj.stepNumber : stepNumber;
          workerName = obj.workerName || workerName;

          if (Buffer.isBuffer(obj.frame)) {
            frameBuffer = obj.frame;
          } else if (obj.frame instanceof ArrayBuffer) {
            frameBuffer = Buffer.from(obj.frame);
          } else if (typeof obj.data === 'string') {
            // Base64 encoded frame
            frameBuffer = Buffer.from(obj.data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          } else if (obj.data instanceof ArrayBuffer) {
            frameBuffer = Buffer.from(obj.data);
          } else {
            throw new Error('Invalid frame data: expected ArrayBuffer or base64 string');
          }
        } else {
          throw new Error('Unsupported payload format for process_frame');
        }

        // Automatic Server-Side Downscaling Safeguard:
        // Ensure frame buffer is <= 60 KB before sending to Redis/BullMQ (protects against Upstash 1MB limit)
        if (frameBuffer.length > 50 * 1024) {
          try {
            frameBuffer = await sharp(frameBuffer)
              .resize({ width: 640, withoutEnlargement: true })
              .jpeg({ quality: 50 })
              .toBuffer();
          } catch (err: any) {
            console.warn(`  ${colors.brightYellow}⚠️ [Gateway] Sharp resize notice:${colors.reset} ${err.message}`);
          }
        }

        const sizeKb = (frameBuffer.length / 1024).toFixed(1);
        const logTime = new Date().toLocaleTimeString('en-US', { hour12: false });

        console.log(
          `[${colors.gray}${logTime}${colors.reset}] 📥 ${colors.brightCyan}process_frame received:${colors.reset} Socket ${colors.yellow}${socket.id}${colors.reset} (${sizeKb} KB) -> Pushing to BullMQ 'ai-vision-queue'`
        );

        // Immediate non-blocking enqueue to BullMQ
        const job = await enqueueVisionFrame({
          socketId: socket.id,
          frameBuffer,
          workOrderId,
          stepNumber,
          workerName,
          timestamp: receiveTimestamp,
        });

        // Optional non-blocking client acknowledgment
        if (typeof ackCallback === 'function') {
          ackCallback({
            status: 'QUEUED',
            jobId: job.id,
            queue: 'ai-vision-queue',
            timestamp: new Date().toISOString(),
          });
        }

        // Also emit a fast queued event to the client
        socket.emit(SOCKET_EVENTS.FRAME_QUEUED, {
          jobId: job.id,
          status: 'QUEUED',
          queue: 'ai-vision-queue',
        });
      } catch (err: any) {
        console.error(
          `  ${colors.brightRed}❌ Error enqueueing frame for socket ${socket.id}:${colors.reset} ${err.message}`
        );

        if (typeof ackCallback === 'function') {
          ackCallback({
            status: 'ERROR',
            message: err.message,
          });
        }

        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.PROCESS_FRAME,
          message: err.message || 'Failed to enqueue frame for processing',
        });
      }
    });
  });

  // -------------------------------------------------------------
  // 2. Join Stream Room (Field Worker / Remote Supervisor)
  // -------------------------------------------------------------
  socket.on(SOCKET_EVENTS.JOIN_STREAM, (payload: JoinStreamPayload) => {
    const { workOrderId, role, workerName } = payload;
    if (!workOrderId) return;

    socket.data.workOrderId = workOrderId;
    socket.data.role = role || 'subscriber';
    socket.data.workerName = workerName || 'Worker';

    const roomName = `room:${workOrderId}`;
    socket.join(roomName);

    const roleBadge = role === 'publisher'
      ? `${colors.bold}${colors.brightGreen}📱 PUBLISHER${colors.reset}`
      : `${colors.bold}${colors.brightCyan}💻 SUBSCRIBER${colors.reset}`;

    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] 🔌 Socket.IO ${roleBadge} (${colors.yellow}${socket.id}${colors.reset}) joined room: ${colors.yellow}${roomName}${colors.reset}`
    );

    socket.emit(SOCKET_EVENTS.STREAM_STATUS, {
      workOrderId,
      status: 'active',
      role,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------
  // 3. Real-Time Video Frame Relay (Supervisor Monitoring)
  // -------------------------------------------------------------
  socket.on(SOCKET_EVENTS.VIDEO_FRAME, (payload: VideoFramePayload) => {
    const workOrderId = payload.workOrderId || socket.data.workOrderId;
    if (!workOrderId || !payload.data) return;

    const roomName = `room:${workOrderId}`;

    // Broadcast frame to supervisor dashboards in this room
    socket.to(roomName).emit(SOCKET_EVENTS.VIDEO_FRAME, {
      ...payload,
      serverTimestamp: Date.now(),
    });

    // Cache in-memory for HTTP queries & monitoring
    liveFrameStore.setFrame(workOrderId, {
      workOrderId,
      stepNumber: payload.stepNumber || 1,
      imageBase64: payload.data,
      timestamp: payload.timestamp || new Date().toISOString(),
      receivedAt: Date.now(),
      workerName: payload.workerName || socket.data.workerName || 'Field Worker',
    });
  });

  // -------------------------------------------------------------
  // 4. Leave Stream Room
  // -------------------------------------------------------------
  socket.on(SOCKET_EVENTS.LEAVE_STREAM, () => {
    const workOrderId = socket.data.workOrderId;
    if (workOrderId) {
      socket.leave(`room:${workOrderId}`);
      socket.data.workOrderId = undefined;
    }
  });

  // -------------------------------------------------------------
  // 5. Force Skip Step (Manual Technician Override)
  // -------------------------------------------------------------
  socket.on('force_skip', async () => {
    try {
      const { ActiveSession } = await import('../models/active-session.model.js');
      const session = await ActiveSession.findOne({ socket_id: socket.id }).populate<{ procedure_id: any }>('procedure_id');

      if (session && session.procedure_id) {
        const procedure = session.procedure_id;
        const nextIndex = session.current_step_index + 1;
        session.current_step_index = nextIndex;
        if (nextIndex >= (procedure.steps?.length || 0)) {
          session.status = 'COMPLETED';
        }
        await session.save();

        const nextStep = procedure.steps?.[nextIndex];
        const result = {
          status: 'IN_PROGRESS',
          confidence: 1.0,
          feedback_hinglish: 'Step skip kiya gaya. Agle step par dhyan dein.',
          current_step_index: nextIndex,
          stepNumber: nextIndex + 1,
          total_steps: procedure.steps?.length || 1,
          next_step_text: nextStep?.instruction_text || 'Inspection completed',
          timestamp: new Date().toISOString(),
        };

        socket.emit(SOCKET_EVENTS.AI_VERDICT, result);
        socket.emit(SOCKET_EVENTS.AI_RESPONSE, result);
      }
    } catch (err: any) {
      console.warn('[Socket.IO] force_skip error:', err.message);
    }
  });

  // -------------------------------------------------------------
  // 6. Heartbeat Ping / Pong
  // -------------------------------------------------------------
  socket.on(SOCKET_EVENTS.HEARTBEAT_ACK, () => {
    // Socket.IO internal ping/pong handles liveness
  });

  // -------------------------------------------------------------
  // 6. Handle Disconnect
  // -------------------------------------------------------------
  socket.on('disconnect', (reason) => {
    const workOrderId = socket.data.workOrderId;
    const role = socket.data.role;
    const disconnectTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (workOrderId) {
      const roomName = `room:${workOrderId}`;
      socket.to(roomName).emit(SOCKET_EVENTS.STREAM_STATUS, {
        workOrderId,
        status: 'disconnected',
        role,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `[${colors.gray}${disconnectTime}${colors.reset}] ❌ Socket Disconnected: ${role || 'client'} (${colors.yellow}${socket.id}${colors.reset}) reason: ${reason}`
    );
  });
}

/**
 * Initialize Socket.IO Gateway with Redis Adapter for horizontal multi-instance scaling
 */
export function initSocketGateway(fastify: FastifyInstance): Server<any, any, any, SocketData> {
  const httpServer = fastify.server as HttpServer;

  // 1. Initialize Pub/Sub Redis Clients for Socket.IO Redis Adapter
  pubClient = createRedisClient('socket-adapter-pub');
  subClient = createRedisClient('socket-adapter-sub');

  // 2. Initialize Socket.IO Server attached to Fastify HTTP server
  ioInstance = new Server<any, any, any, SocketData>(httpServer, {
    ...SOCKET_IO_CONFIG,
    adapter: createAdapter(pubClient, subClient),
  });

  // 3. Decorate Fastify instance and Request object so socket is globally accessible
  if (!fastify.hasDecorator('io')) {
    fastify.decorate('io', ioInstance);
  }
  if (!fastify.hasRequestDecorator('io')) {
    fastify.decorateRequest('io', {
      getter() {
        return ioInstance!;
      },
    });
  }

  // 4. Attach connection lifecycle
  ioInstance.on('connection', (socket) => {
    handleSocketConnection(socket);
  });

  const port = fastify.config?.PORT || 3000;
  console.log(`${colors.brightCyan}⚡ Socket.IO Gateway (Redis Adapter):${colors.reset} ws://0.0.0.0:${port}/socket.io/`);

  return ioInstance;
}

/**
 * Broadcast an event to all clients in a work order room
 */
export function broadcastToRoom(workOrderId: string, event: string, data: any) {
  if (!ioInstance) return;
  ioInstance.to(`room:${workOrderId}`).emit(event, data);
}

/**
 * Get the current active Socket.IO server instance
 */
export function getSocketIO(): Server<any, any, any, SocketData> | null {
  return ioInstance;
}

/**
 * Close and clean up Socket.IO gateway, Redis pub/sub clients, and BullMQ queue
 */
export async function closeSocketGateway(): Promise<void> {
  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
  if (pubClient) {
    await pubClient.quit();
    pubClient = null;
  }
  if (subClient) {
    await subClient.quit();
    subClient = null;
  }
  await closeVisionQueue();
}
