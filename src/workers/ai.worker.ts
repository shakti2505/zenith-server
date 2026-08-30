import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Emitter } from '@socket.io/redis-emitter';
import { QUEUE_NAMES } from '../queues/queue.config.js';
import { VisionJobData, VisionResultPayload } from '../types/vision.types.js';
import { getRedisOptions, createRedisClient } from '../config/redis.js';
import { SOCKET_EVENTS } from '../sockets/socket.config.js';
import { evaluateVisualStep, VisualStepEvaluation } from '../services/ai.service.js';
import { ActiveSession, IProcedure } from '../models/index.js';
import { colors } from '../plugins/requestLogger.js';

let workerInstance: Worker<VisionJobData, VisionResultPayload> | null = null;
let workerDedicatedRedis: Redis | null = null;
let emitterClient: ReturnType<typeof createRedisClient> | null = null;
let ioEmitter: Emitter | null = null;

/**
 * Initialize Socket.IO Redis Emitter for broadcasting events from background workers
 */
export function getSocketEmitter(): Emitter {
  if (!ioEmitter) {
    emitterClient = createRedisClient('socket-emitter');
    ioEmitter = new Emitter(emitterClient);
  }
  return ioEmitter;
}

/**
 * Start the BullMQ Vision Worker with Database State Management & LangChain AI Service
 */
export function startVisionWorker(): Worker<VisionJobData, VisionResultPayload> {
  if (workerInstance) {
    return workerInstance;
  }

  // 1. Dedicated Redis Connection for BullMQ Worker (prevent blocking BRPOP from freezing app traffic)
  const redisUrl = process.env.REDIS_URL?.trim();
  const redisOptions = getRedisOptions();
  workerDedicatedRedis = redisUrl ? new Redis(redisUrl, redisOptions) : new Redis(redisOptions);

  workerDedicatedRedis.once('ready', () => {
    console.log(
      `  ${colors.brightGreen}⚡ Redis (worker-dedicated) Ready & Listening:${colors.reset} ${redisOptions.host}:${redisOptions.port}`
    );
  });

  const emitter = getSocketEmitter();

  console.log(
    `  ${colors.brightCyan}🤖 BullMQ Vision Worker:${colors.reset} Initializing listener on '${QUEUE_NAMES.AI_VISION}'...`
  );

  // 2. Instantiate BullMQ Worker
  workerInstance = new Worker<VisionJobData, VisionResultPayload>(
    QUEUE_NAMES.AI_VISION,
    async (job: Job<VisionJobData, VisionResultPayload>) => {
      const startTime = Date.now();
      const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const { socketId, workOrderId, stepNumber, frameBuffer } = job.data;

      console.log(
        `[${colors.gray}${timeStr}${colors.reset}] 🧠 ${colors.bold}${colors.brightMagenta}[JOB PROCESSING]${colors.reset} Job #${colors.bold}${job.id}${colors.reset} ➔ Socket: ${colors.yellow}${socketId}${colors.reset}`
      );

      try {
        // Step A: Convert binary frameBuffer to clean base64 string
        let base64Image: string;
        if (typeof frameBuffer === 'string') {
          base64Image = frameBuffer;
        } else if (Buffer.isBuffer(frameBuffer)) {
          base64Image = frameBuffer.toString('base64');
        } else {
          base64Image = Buffer.from(frameBuffer).toString('base64');
        }

        // Step B: Query ActiveSession and Populate Associated Procedure
        let systemPrompt: string;
        let currentStepIndex = stepNumber ? stepNumber - 1 : 0;
        let session: any = null;

        try {
          session = await ActiveSession.findOne({ socket_id: socketId }).populate<{ procedure_id: IProcedure }>(
            'procedure_id'
          );

          if (session && session.procedure_id) {
            const procedure = session.procedure_id as IProcedure;
            currentStepIndex = session.current_step_index || 0;
            const currentStep = procedure.steps?.[currentStepIndex];
            const instructionText = currentStep?.instruction_text || 'Perform general visual maintenance inspection.';
            const safetyWarning = currentStep?.safety_warning ? ` Safety Warning: ${currentStep.safety_warning}.` : '';

            // Dynamically build system prompt with DB procedure context
            systemPrompt = `You are an AI guiding a technician. The current task is: ${procedure.title}. The current step is: ${instructionText}.${safetyWarning} Analyze the image. If the step is fully completed, return status 'COMPLETED'. If they are still working on it, return 'IN_PROGRESS'. If a safety danger is detected, return 'HAZARD'. If the image does not contain the relevant equipment, tools, or hands working on the task (e.g., it shows a floor, ceiling, or completely unrelated scene), return status as INVALID_VIEW with feedback like "Camera ko machine ki taraf point karein". If the image is too blurry, out of focus, or too dark to confidently evaluate the step, return status as IMAGE_UNCLEAR with feedback like "Photo dhundhli hai, phone thoda peeche karein.".`;
          } else {
            // Contextual fallback prompt if session is not yet registered
            systemPrompt = `You are an AI guiding a technician. The current task is: ${workOrderId || 'Industrial Maintenance'}. The current step is #${currentStepIndex + 1}. Analyze the image. If the step is fully completed, return status 'COMPLETED'. If they are still working on it, return 'IN_PROGRESS'. If a safety danger is detected, return 'HAZARD'. If the image does not contain the relevant equipment, tools, or hands working on the task (e.g., it shows a floor, ceiling, or completely unrelated scene), return status as INVALID_VIEW with feedback like "Camera ko machine ki taraf point karein". If the image is too blurry, out of focus, or too dark to confidently evaluate the step, return status as IMAGE_UNCLEAR with feedback like "Photo dhundhli hai, phone thoda peeche karein.".`;
          }
        } catch (dbErr) {
          console.warn('[Worker] Session DB lookup notice:', dbErr);
          systemPrompt = `You are an AI guiding a technician. Analyze the image. If the step is fully completed, return status 'COMPLETED'. If they are still working on it, return 'IN_PROGRESS'. If a safety danger is detected, return 'HAZARD'. If the image does not contain the relevant equipment, tools, or hands working on the task (e.g., it shows a floor, ceiling, or completely unrelated scene), return status as INVALID_VIEW with feedback like "Camera ko machine ki taraf point karein". If the image is too blurry, out of focus, or too dark to confidently evaluate the step, return status as IMAGE_UNCLEAR with feedback like "Photo dhundhli hai, phone thoda peeche karein.".`;
        }

        // Step C: Invoke LangChain Gemini Vision Service with Structured Output
        const aiEvaluation: VisualStepEvaluation = await evaluateVisualStep(
          base64Image,
          systemPrompt
        );

        // Step D: Three-Strike System & ActiveSession State Progression
        let updatedStepIndex = currentStepIndex;

        if (session) {
          // Track consecutive invalid frames
          if (aiEvaluation.status === 'INVALID_VIEW') {
            session.invalid_frame_count = (session.invalid_frame_count || 0) + 1;
            console.log(
              `  ${colors.brightYellow}⚠️ [INVALID VIEW]${colors.reset} Socket: ${socketId} consecutive invalid frames: ${session.invalid_frame_count}/3`
            );
          } else {
            session.invalid_frame_count = 0;
          }

          // The Strike Out: If invalid_frame_count >= 3
          if (session.invalid_frame_count >= 3) {
            console.log(
              `  ${colors.brightYellow}⏸️ [THREE-STRIKE PAUSE]${colors.reset} Socket: ${socketId} reached 3 consecutive invalid frames. Emitting 'pause_loop'.`
            );

            const pausePayload = {
              reason: 'No equipment detected for a while. Pausing to save data.',
            };

            // Emit specific Socket.io event: socket.emit('pause_loop', { reason: 'No equipment detected for a while. Pausing to save data.' })
            emitter.to(socketId).emit(SOCKET_EVENTS.PAUSE_LOOP, pausePayload);
            emitter.to(socketId).emit('pause_loop', pausePayload);

            if (workOrderId) {
              emitter.to(`room:${workOrderId}`).emit('pause_loop', {
                socketId,
                workOrderId,
                ...pausePayload,
                isRoomBroadcast: true,
              });
            }

            // Reset invalid_frame_count to 0 in the database to prepare for when they resume
            session.invalid_frame_count = 0;
            await session.save();

            const processingTimeMs = Date.now() - startTime;

            console.log(
              `[${colors.gray}${timeStr}${colors.reset}] ⏸️ ${colors.bold}${colors.brightYellow}[LOOP PAUSED]${colors.reset} Job #${colors.bold}${job.id}${colors.reset} ➔ Socket: ${colors.yellow}${socketId}${colors.reset} | Three-strike pause triggered`
            );

            // Return early (do not emit the standard ai_verdict)
            return {
              status: 'INVALID_VIEW',
              confidence: aiEvaluation.confidence,
              feedback_hinglish: aiEvaluation.feedback_hinglish || 'Camera ko machine ki taraf point karein.',
              jobId: job.id,
              workOrderId,
              stepNumber: currentStepIndex + 1,
              current_step_index: currentStepIndex,
              processingTimeMs,
              timestamp: new Date().toISOString(),
            };
          }

          // State Progression in MongoDB on COMPLETED
          if (aiEvaluation.status === 'COMPLETED' && session.procedure_id) {
            const procedure = session.procedure_id as IProcedure;
            const nextIndex = (session.current_step_index || 0) + 1;

            session.current_step_index = nextIndex;
            if (nextIndex >= (procedure.steps?.length || 0)) {
              session.status = 'COMPLETED';
            }

            updatedStepIndex = nextIndex;
            console.log(
              `  ${colors.brightGreen}📈 [STATE PROGRESSION]${colors.reset} Socket: ${socketId} advanced to step index ${updatedStepIndex} (Status: ${session.status})`
            );
          }

          // Save the updated ActiveSession
          await session.save();
        }

        // Compute next_step_text and total_steps from procedure
        let totalSteps = 1;
        let nextStepText: string | undefined = undefined;
        if (session && session.procedure_id) {
          const procedure = session.procedure_id as IProcedure;
          totalSteps = procedure.steps?.length || 1;
          const nextStep = procedure.steps?.[updatedStepIndex];
          if (nextStep) {
            nextStepText = nextStep.instruction_text + (nextStep.safety_warning ? ` (⚠️ ${nextStep.safety_warning})` : '');
          }
        }

        const processingTimeMs = Date.now() - startTime;

        const result: VisionResultPayload = {
          status: aiEvaluation.status,
          confidence: aiEvaluation.confidence,
          feedback_hinglish: aiEvaluation.feedback_hinglish,
          jobId: job.id,
          workOrderId,
          stepNumber: updatedStepIndex + 1,
          current_step_index: updatedStepIndex,
          total_steps: totalSteps,
          next_step_text: nextStepText,
          processingTimeMs,
          timestamp: new Date().toISOString(),
        };

        // Step E: Emit resulting structured JSON via Socket.IO Redis Emitter to user's socketId
        emitter.to(socketId).emit(SOCKET_EVENTS.FRAME_PROCESSED, result);
        emitter.to(socketId).emit(SOCKET_EVENTS.AI_RESPONSE, result);
        emitter.to(socketId).emit(SOCKET_EVENTS.AI_VERDICT, result);

        // Optional: Broadcast to Work Order supervisory dashboard room
        if (workOrderId) {
          emitter.to(`room:${workOrderId}`).emit(SOCKET_EVENTS.FRAME_PROCESSED, {
            ...result,
            isRoomBroadcast: true,
          });
          emitter.to(`room:${workOrderId}`).emit(SOCKET_EVENTS.AI_RESPONSE, {
            ...result,
            isRoomBroadcast: true,
          });
          emitter.to(`room:${workOrderId}`).emit(SOCKET_EVENTS.AI_VERDICT, {
            ...result,
            isRoomBroadcast: true,
          });
        }

        console.log(
          `[${colors.gray}${timeStr}${colors.reset}] ✅ ${colors.bold}${colors.brightGreen}[JOB COMPLETED]${colors.reset} Job #${colors.bold}${job.id}${colors.reset} ➔ Socket: ${colors.yellow}${socketId}${colors.reset} [${result.status}] (Step Index: ${updatedStepIndex}) | Latency: ${colors.brightCyan}${result.processingTimeMs}ms${colors.reset} | Feedback: "${colors.brightGreen}${result.feedback_hinglish}${colors.reset}"`
        );

        return result;
      } catch (err: any) {
        // Robust Error Handling: Network timeouts / rate limits won't crash the worker
        console.error(
          `[${colors.gray}${timeStr}${colors.reset}] ❌ ${colors.bold}${colors.brightRed}[JOB FAILED]${colors.reset} Job #${job.id}: ${err.message}`
        );

        const failureResult: VisionResultPayload = {
          status: 'FAILED',
          feedback_hinglish: 'Error: Frame process nahi ho paya. Dobara try karein.',
          jobId: job.id,
          workOrderId,
          stepNumber,
          timestamp: new Date().toISOString(),
        };

        emitter.to(socketId).emit(SOCKET_EVENTS.FRAME_PROCESSED, failureResult);
        emitter.to(socketId).emit(SOCKET_EVENTS.AI_RESPONSE, failureResult);
        emitter.to(socketId).emit(SOCKET_EVENTS.AI_VERDICT, failureResult);

        throw err;
      }
    },
    {
      connection: workerDedicatedRedis,
      concurrency: 5,
    }
  );

  workerInstance.on('ready', () => {
    console.log(
      `  ${colors.brightGreen}⚡ BullMQ Vision Worker is READY & actively listening on '${QUEUE_NAMES.AI_VISION}'${colors.reset}`
    );
  });

  workerInstance.on('completed', (job: Job) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] 🏁 ${colors.brightGreen}[BULLMQ EVENT]${colors.reset} Job #${job.id} acknowledged & evicted from Redis`
    );
  });

  workerInstance.on('failed', (job, err) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.error(
      `[${colors.gray}${timeStr}${colors.reset}] ❌ ${colors.brightRed}[BULLMQ EVENT]${colors.reset} Job #${job?.id} failed: ${err.message}`
    );
  });

  workerInstance.on('error', (err: any) => {
    if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT') {
      console.error(`  ${colors.brightRed}❌ BullMQ Worker Error:${colors.reset} ${err.message}`);
    }
  });

  return workerInstance;
}

export async function stopVisionWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (workerDedicatedRedis) {
    await workerDedicatedRedis.quit();
    workerDedicatedRedis = null;
  }
  if (emitterClient) {
    await emitterClient.quit();
    emitterClient = null;
    ioEmitter = null;
  }
}

// Alias exports
export { startVisionWorker as startAiWorker, stopVisionWorker as stopAiWorker };
