import { FastifyRequest, FastifyReply } from 'fastify';
import { ProcedureService } from './procedure.service.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';
import { colors } from '../../plugins/requestLogger.js';

export class ProcedureController {
  /**
   * POST /api/procedures/upload-custom
   * Upload image or PDF manual and generate structured SOP
   */
  static async uploadCustomProcedure(request: FastifyRequest, reply: FastifyReply) {
    const file = await request.file();

    if (!file) {
      throw AppError.badRequest('No document file uploaded. Please upload a JPEG/PNG image or PDF manual.');
    }

    const mimeType = file.mimetype || 'image/jpeg';
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    if (!allowedMimes.includes(mimeType)) {
      throw AppError.badRequest(`Unsupported file type (${mimeType}). Allowed formats: JPEG, PNG, WEBP, PDF.`);
    }

    console.log(
      `  ${colors.brightCyan}📄 [SOP UPLOAD]${colors.reset} Processing uploaded manual: ${file.filename} (${mimeType})...`
    );

    const fileBuffer = await file.toBuffer();
    const procedure = await ProcedureService.uploadAndGenerateProcedure(fileBuffer, mimeType);

    console.log(
      `  ${colors.brightGreen}✅ [SOP GENERATED]${colors.reset} Procedure '${procedure.title}' created (ID: ${procedure._id}, Steps: ${procedure.steps.length})`
    );

    return reply.status(201).send({
      success: true,
      procedure_id: procedure._id,
      procedure,
    });
  }

  /**
   * GET /api/procedures
   */
  static async listProcedures(
    request: FastifyRequest<{ Querystring: { is_custom?: string } }>,
    reply: FastifyReply
  ) {
    const isCustom = request.query.is_custom !== undefined ? request.query.is_custom === 'true' : undefined;
    const filter = isCustom !== undefined ? { is_custom: isCustom } : {};
    const procedures = await ProcedureService.listProcedures(filter);

    return sendSuccess(reply, {
      message: 'Procedures retrieved successfully',
      data: procedures,
      meta: { count: procedures.length },
    });
  }

  /**
   * GET /api/procedures/:id
   */
  static async getProcedureById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const procedure = await ProcedureService.getProcedureById(id);

    if (!procedure) {
      throw AppError.notFound(`Procedure with ID ${id} not found`);
    }

    return sendSuccess(reply, {
      message: 'Procedure details retrieved',
      data: procedure,
    });
  }
}
