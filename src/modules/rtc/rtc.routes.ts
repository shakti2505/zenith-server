import { FastifyPluginAsync } from 'fastify';
import { RtcController } from './rtc.controller.js';

export const rtcRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/token', RtcController.generateToken);
};
