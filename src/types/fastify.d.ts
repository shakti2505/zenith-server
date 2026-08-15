import 'fastify';

export interface AppConfig {
  PORT: number;
  HOST: string;
  LOG_LEVEL: string;
  MONGODB_URI: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_URL: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}
