import { FastifyPluginAsync } from 'fastify';
import { TelemetryController } from './telemetry.controller.js';

export const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', TelemetryController.getTelemetry);
  fastify.get('/stats', TelemetryController.getStats);
  fastify.post('/', TelemetryController.recordTelemetry);
  fastify.get('/live-frame/:workOrderId', TelemetryController.getLiveFrame);
  fastify.get('/stream/:workOrderId', TelemetryController.streamLiveFrames);
  fastify.post('/live-frame', TelemetryController.postLiveFrame);
};
