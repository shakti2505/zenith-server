import 'fastify';
import { Server } from 'socket.io';
import { SocketData } from '../sockets/socket.config.js';

export interface AppConfig {
  PORT: number;
  HOST: string;
  LOG_LEVEL: string;
  MONGODB_URI: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_URL?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    io: Server<any, any, any, SocketData>;
  }
  interface FastifyRequest {
    io: Server<any, any, any, SocketData>;
  }
}
