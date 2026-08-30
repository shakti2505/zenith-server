import { Procedure, IProcedure } from './procedure.model.js';
import { generateProcedureFromSOP, GeneratedProcedure } from '../../services/sop.service.js';

export class ProcedureService {
  /**
   * Upload and dynamically generate a structured SOP procedure using LangChain + Gemini
   */
  static async uploadAndGenerateProcedure(
    fileBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<IProcedure> {
    const base64Document = fileBuffer.toString('base64');
    const parsed: GeneratedProcedure = await generateProcedureFromSOP(base64Document, mimeType);

    const procedure = await Procedure.create({
      title: parsed.title,
      description: parsed.description,
      steps: parsed.steps,
      is_custom: true,
    });

    return procedure.toObject();
  }

  /**
   * List all stored procedures (Fast plain JS object read using .lean())
   */
  static async listProcedures(filter: { is_custom?: boolean } = {}): Promise<IProcedure[]> {
    return await Procedure.find(filter).sort({ createdAt: -1 }).lean<IProcedure[]>();
  }

  /**
   * Get procedure by MongoDB ID (Fast plain JS object read using .lean())
   */
  static async getProcedureById(id: string): Promise<IProcedure | null> {
    return await Procedure.findById(id).lean<IProcedure | null>();
  }
}
