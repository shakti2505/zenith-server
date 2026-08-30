import { FastifyPluginAsync } from 'fastify';
import { ProcedureController } from './procedure.controller.js';

export const procedureRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload-custom', ProcedureController.uploadCustomProcedure);
  fastify.get('/', ProcedureController.listProcedures);
  fastify.get('/:id', ProcedureController.getProcedureById);
};
