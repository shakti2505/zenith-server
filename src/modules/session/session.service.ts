import { ActiveSession, IActiveSession } from './active-session.model.js';
import { Procedure } from '../procedure/procedure.model.js';
import { AppError } from '../../utils/AppError.js';

export class SessionService {
  /**
   * Start or create an active inspection session
   */
  static async startSession(procedureId: string, socketId: string = 'unassigned_socket'): Promise<IActiveSession> {
    const procedure = await Procedure.findById(procedureId).lean();
    if (!procedure) {
      throw AppError.notFound('Procedure not found');
    }

    const session = await ActiveSession.create({
      socket_id: socketId,
      procedure_id: procedure._id,
      current_step_index: 0,
      status: 'IN_PROGRESS',
    });

    return session.toObject();
  }

  /**
   * Get session by ID with populated procedure (Fast plain JS object read using .lean())
   */
  static async getSessionById(id: string): Promise<IActiveSession | null> {
    return await ActiveSession.findById(id).populate('procedure_id').lean<IActiveSession | null>();
  }

  /**
   * Get session by socketId (Fast plain JS object read using .lean())
   */
  static async getSessionBySocketId(socketId: string): Promise<IActiveSession | null> {
    return await ActiveSession.findOne({ socket_id: socketId }).populate('procedure_id').lean<IActiveSession | null>();
  }
}
