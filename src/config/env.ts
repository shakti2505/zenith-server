import { FastifyEnvOptions } from '@fastify/env';

const schema = {
  type: 'object',
  required: ['MONGODB_URI', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0',
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
    },
    MONGODB_URI: {
      type: 'string',
      default: 'mongodb://localhost:27017/industrial_copilot',
    },
    LIVEKIT_API_KEY: {
      type: 'string',
      default: 'devkey',
    },
    LIVEKIT_API_SECRET: {
      type: 'string',
      default: 'secret',
    },
    LIVEKIT_URL: {
      type: 'string',
      default: 'wss://your-livekit-server-url.livekit.cloud',
    },
    OPENAI_API_KEY: {
      type: 'string',
      default: '',
    },
    GEMINI_API_KEY: {
      type: 'string',
      default: '',
    },
  },
};

export const envOptions: FastifyEnvOptions = {
  confKey: 'config',
  schema: schema,
  dotenv: true,
  data: process.env,
};
