import { FastifyPluginAsync } from 'fastify';
import { generateProcedureFromSOP } from '../services/sop.service.js';
import { Procedure } from '../models/procedure.model.js';
import { colors } from '../plugins/requestLogger.js';

export const procedureRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/procedures/upload-custom
   * Upload an image (JPEG, PNG) or PDF manual and dynamically generate a structured SOP Procedure
   */
  fastify.post('/upload-custom', async (request, reply) => {
    try {
      // 1. Process uploaded multipart file
      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          success: false,
          error: 'No document file uploaded. Please upload a JPEG/PNG image or PDF manual.',
        });
      }

      const mimeType = file.mimetype || 'image/jpeg';
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

      if (!allowedMimes.includes(mimeType)) {
        return reply.status(400).send({
          success: false,
          error: `Unsupported file type (${mimeType}). Allowed formats: JPEG, PNG, WEBP, PDF.`,
        });
      }

      console.log(
        `  ${colors.brightCyan}📄 [SOP UPLOAD]${colors.reset} Processing uploaded manual: ${file.filename} (${mimeType})...`
      );

      // 2. Read file stream into Buffer and convert to base64
      const fileBuffer = await file.toBuffer();
      const base64Document = fileBuffer.toString('base64');

      // 3. Extract and parse structured procedure via LangChain Gemini 1.5 Flash
      const parsedProcedure = await generateProcedureFromSOP(base64Document, mimeType);

      // 4. Save directly into MongoDB Procedure collection with is_custom: true
      const newProcedure = await Procedure.create({
        title: parsedProcedure.title,
        description: parsedProcedure.description,
        steps: parsedProcedure.steps,
        is_custom: true,
      });

      console.log(
        `  ${colors.brightGreen}✅ [SOP GENERATED]${colors.reset} Procedure '${newProcedure.title}' created (ID: ${newProcedure._id}, Steps: ${newProcedure.steps.length})`
      );

      return reply.status(201).send({
        success: true,
        procedure_id: newProcedure._id,
        procedure: newProcedure,
      });
    } catch (err: any) {
      console.error(`  ${colors.brightRed}❌ [SOP GENERATION ERROR]${colors.reset}:`, err.message);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate procedure from uploaded document.',
        details: err.message,
      });
    }
  });

  /**
   * GET /api/procedures
   * List all stored procedures
   */
  fastify.get('/', async (request, reply) => {
    try {
      const procedures = await Procedure.find().sort({ createdAt: -1 }).lean();
      return reply.send({
        success: true,
        count: procedures.length,
        data: procedures,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/procedures/:id
   * Fetch a single procedure by ID
   */
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const procedure = await Procedure.findById(id).lean();

      if (!procedure) {
        return reply.status(404).send({ success: false, error: 'Procedure not found.' });
      }

      return reply.send({
        success: true,
        data: procedure,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};
