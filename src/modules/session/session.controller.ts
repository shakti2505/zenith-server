import { FastifyRequest, FastifyReply } from 'fastify';
import { SessionService } from './session.service.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';
import { colors } from '../../plugins/requestLogger.js';

export class SessionController {
  /**
   * POST /api/sessions/start
   */
  static async startSession(
    request: FastifyRequest<{ Body: { procedure_id: string; socket_id?: string } }>,
    reply: FastifyReply
  ) {
    const { procedure_id, socket_id } = request.body || {};

    if (!procedure_id) {
      throw AppError.badRequest('procedure_id is required to start an inspection session');
    }

    const session = await SessionService.startSession(procedure_id, socket_id);

    console.log(
      `  ${colors.brightGreen}🚀 [SESSION STARTED]${colors.reset} Session ID: ${session._id} for Procedure ID: ${procedure_id}`
    );

    return reply.status(201).send({
      success: true,
      session_id: session._id,
      procedure_id: session.procedure_id,
      session,
    });
  }

  /**
   * GET /api/sessions/:id
   */
  static async getSessionById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const session = await SessionService.getSessionById(id);

    if (!session) {
      throw AppError.notFound(`Session with ID ${id} not found`);
    }

    return sendSuccess(reply, {
      message: 'Session details retrieved',
      data: session,
    });
  }
}
