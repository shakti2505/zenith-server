import { FastifyPluginAsync } from 'fastify';
import { TelemetryController } from './telemetry.controller.js';

export const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', TelemetryController.getTelemetry);
  fastify.get('/stats', TelemetryController.getStats);
  fastify.post('/', TelemetryController.recordTelemetry);
};
