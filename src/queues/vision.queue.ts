import { Queue, Job } from 'bullmq';
import { QUEUE_NAMES, DEFAULT_VISION_JOB_OPTIONS } from './queue.config.js';
import { VisionJobData, VisionResultPayload } from '../types/vision.types.js';
import { sharedRedisClient } from '../config/redis.js';
import { colors } from '../plugins/requestLogger.js';

let visionQueueInstance: Queue<VisionJobData, VisionResultPayload> | null = null;

/**
 * 1. Initialize BullMQ Queue using the SINGLE Shared ioredis connection (Multiplexing)
 * 2. Enforces strict eviction via DEFAULT_VISION_JOB_OPTIONS
 */
export function getVisionQueue(): Queue<VisionJobData, VisionResultPayload> {
  if (!visionQueueInstance) {
    visionQueueInstance = new Queue<VisionJobData, VisionResultPayload>(
      QUEUE_NAMES.AI_VISION,
      {
        connection: sharedRedisClient,
        defaultJobOptions: DEFAULT_VISION_JOB_OPTIONS,
      }
    );

    visionQueueInstance.on('error', (err: any) => {
      if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT') {
        console.error(`  ${colors.brightRed}❌ BullMQ [${QUEUE_NAMES.AI_VISION}] Queue Error:${colors.reset} ${err.message}`);
      }
    });
  }

  return visionQueueInstance;
}

/**
 * Non-blocking helper to enqueue a video frame for AI vision analysis
 */
export async function enqueueVisionFrame(
  jobData: VisionJobData
): Promise<Job<VisionJobData, VisionResultPayload>> {
  const queue = getVisionQueue();
  const jobName = `process_frame_${jobData.socketId}_${Date.now()}`;

  // Ensure frameBuffer is a compact string (base64) rather than raw Node Buffer
  // to avoid BullMQ JSON serialization inflating buffers into 20MB integer arrays
  let compactFrame: string;
  if (typeof jobData.frameBuffer === 'string') {
    compactFrame = jobData.frameBuffer;
  } else if (Buffer.isBuffer(jobData.frameBuffer)) {
    compactFrame = jobData.frameBuffer.toString('base64');
  } else {
    compactFrame = Buffer.from(jobData.frameBuffer).toString('base64');
  }

  const job = await queue.add(
    jobName,
    {
      ...jobData,
      frameBuffer: compactFrame,
    },
    {
      ...DEFAULT_VISION_JOB_OPTIONS,
    }
  );

  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const sizeKb = (compactFrame.length / 1024).toFixed(1);

  console.log(
    `[${colors.gray}${timeStr}${colors.reset}] 📥 ${colors.bold}${colors.brightCyan}[JOB ENQUEUED]${colors.reset} Job #${colors.bold}${job.id}${colors.reset} ➔ Queue: '${colors.yellow}${QUEUE_NAMES.AI_VISION}${colors.reset}' | Socket: ${colors.yellow}${jobData.socketId}${colors.reset} | Size: ${colors.brightMagenta}${sizeKb} KB${colors.reset} | Step: ${jobData.stepNumber || 1}`
  );

  return job;
}

/**
 * Retrieve current metrics and status of jobs in the AI Vision Queue
 */
export async function getVisionQueueMetrics() {
  const queue = getVisionQueue();
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  const recentJobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 9);

  return {
    queueName: QUEUE_NAMES.AI_VISION,
    counts,
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      name: j.name,
      socketId: j.data.socketId,
      workOrderId: j.data.workOrderId,
      stepNumber: j.data.stepNumber,
      timestamp: j.data.timestamp,
      processedOn: j.processedOn,
      finishedOn: j.finishedOn,
      failedReason: j.failedReason,
    })),
  };
}

/**
 * Gracefully close the BullMQ queue instance
 */
export async function closeVisionQueue(): Promise<void> {
  if (visionQueueInstance) {
    await visionQueueInstance.close();
    visionQueueInstance = null;
  }
}
