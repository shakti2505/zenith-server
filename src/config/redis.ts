import { Redis, RedisOptions } from 'ioredis';
import dotenv from 'dotenv';
import { colors } from '../plugins/requestLogger.js';

dotenv.config();

/**
 * Build Redis connection options for BullMQ, Socket.IO adapters, and general caching
 * Note: BullMQ and Socket.IO adapters require maxRetriesPerRequest: null
 */
export function getRedisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
  const redisUrl = process.env.REDIS_URL?.trim();

  // If full connection string (e.g., Upstash rediss://...) is provided
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      const isUpstash = parsed.hostname.includes('upstash.io');
      const isTls = parsed.protocol === 'rediss:' || isUpstash;

      const options: RedisOptions = {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        username: parsed.username || 'default',
        password: parsed.password || undefined,
        tls: isTls ? { servername: parsed.hostname } : undefined,
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: true, // Allow ioredis to emit 'ready' so BullMQ starts polling immediately
        keepAlive: 10000, // Send TCP keepalive every 10s to keep Upstash proxy alive
        family: 4, // Force IPv4
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
        lazyConnect: false,
        ...overrides,
      };

      return options;
    } catch {
      // Fallback if URL parsing fails
    }
  }

  // Standard host/port configuration
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  const baseOptions: RedisOptions = {
    host,
    port,
    password: password || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    keepAlive: 10000,
    family: 4,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
    lazyConnect: false,
    ...overrides,
  };

  return baseOptions;
}

/**
 * Factory function to create a new dedicated Redis client instance
 */
export function createRedisClient(name = 'default', customOptions: Partial<RedisOptions> = {}): Redis {
  const redisUrl = process.env.REDIS_URL?.trim();
  const options = getRedisOptions(customOptions);

  const client = redisUrl ? new Redis(redisUrl, options) : new Redis(options);

  client.once('connect', () => {
    console.log(`  ${colors.brightGreen}⚡ Redis (${name}) Connected:${colors.reset} ${options.host}:${options.port}`);
  });

  client.once('ready', () => {
    console.log(`  ${colors.brightGreen}⚡ Redis (${name}) Ready & Listening:${colors.reset} ${options.host}:${options.port}`);
  });

  client.on('error', (err: any) => {
    // Upstash serverless proxies close idle connections periodically with ECONNRESET.
    // ioredis reconnects automatically in under 100ms.
    if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT') {
      console.error(`  ${colors.brightRed}❌ Redis (${name}) Error:${colors.reset} ${err.message}`);
    }
  });

  return client;
}

/**
 * 1. SINGLE Shared ioredis Instance (Connection Multiplexing)
 * Used for generic Redis caching and instantiating BullMQ Queues (Producers).
 */
export const sharedRedisClient: Redis = createRedisClient('shared');
