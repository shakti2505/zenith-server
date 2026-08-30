import { FastifyEnvOptions } from '@fastify/env';

const schema = {
  type: 'object',
  required: ['MONGODB_URI'],
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
      default: 'mongodb://127.0.0.1:27017/industrial_copilot',
    },
    REDIS_HOST: {
      type: 'string',
      default: '127.0.0.1',
    },
    REDIS_PORT: {
      type: 'number',
      default: 6379,
    },
    REDIS_PASSWORD: {
      type: 'string',
      default: '',
    },
    REDIS_URL: {
      type: 'string',
      default: '',
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
