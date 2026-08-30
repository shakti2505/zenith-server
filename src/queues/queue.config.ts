import { JobsOptions } from 'bullmq';

export const QUEUE_NAMES = {
  AI_VISION: 'ai-vision-queue',
} as const;

/**
 * 2. Strict Memory Management Job Options
 * Guarantees jobs are deleted from Redis immediately upon success to protect the Upstash free tier.
 */
export const DEFAULT_VISION_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: true, // Instantly delete job from Redis on success (0 bytes retained)
  removeOnFail: {
    count: 50, // Keep max 50 failed jobs for debugging
    age: 3600, // 1 hour retention
  },
  attempts: 1, // Real-time frame: do not retry stale frames when new ones are already incoming
};
