import { FastifyPluginAsync } from 'fastify';
import { ActiveSession } from '../models/active-session.model.js';
import { Procedure } from '../models/procedure.model.js';
import { colors } from '../plugins/requestLogger.js';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/sessions/start
   * Start or register an ActiveSession for a given procedure
   */
  fastify.post('/start', async (request, reply) => {
    try {
      const { procedure_id, socket_id = 'unassigned_socket' } = (request.body || {}) as {
        procedure_id: string;
        socket_id?: string;
      };

      if (!procedure_id) {
        return reply.status(400).send({
          success: false,
          error: 'procedure_id is required to start a session.',
        });
      }

      const procedure = await Procedure.findById(procedure_id);
      if (!procedure) {
        return reply.status(404).send({
          success: false,
          error: 'Procedure not found.',
        });
      }

      // Upsert active session for client
      const session = await ActiveSession.create({
        socket_id,
        procedure_id: procedure._id,
        current_step_index: 0,
        status: 'IN_PROGRESS',
      });

      console.log(
        `  ${colors.brightGreen}🚀 [SESSION STARTED]${colors.reset} Session ID: ${session._id} for Procedure '${procedure.title}'`
      );

      return reply.status(201).send({
        success: true,
        session_id: session._id,
        procedure_id: procedure._id,
        procedure,
        session,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to start session.',
        details: err.message,
      });
    }
  });

  /**
   * GET /api/sessions/:id
   */
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const session = await ActiveSession.findById(id).populate('procedure_id');
      if (!session) {
        return reply.status(404).send({ success: false, error: 'Session not found.' });
      }
      return reply.send({ success: true, data: session });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};
