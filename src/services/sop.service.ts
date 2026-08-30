import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Strict Zod Schema for Structured SOP Procedure Generation
 */
export const generatedProcedureSchema = z.object({
  title: z
    .string()
    .describe('Concise, professional title for the industrial procedure or equipment task'),
  description: z
    .string()
    .describe('Brief overview of the operation, equipment, and purpose of the SOP'),
  steps: z
    .array(
      z.object({
        step_number: z.number().describe('Sequential step index starting at 1'),
        instruction_text: z
          .string()
          .describe(
            'Actionable, clear operational step translated into simple, natural Hinglish for industrial field workers'
          ),
        safety_warning: z
          .string()
          .optional()
          .describe(
            'Specific safety hazards, PPE requirements, or precautions associated with this step if mentioned in the source document'
          ),
      })
    )
    .min(1)
    .describe('Sequential step-by-step instructions extracted from the manual'),
});

export type GeneratedProcedure = z.infer<typeof generatedProcedureSchema>;

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function createSopModel(modelName: string): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature: 0.2,
    maxRetries: 2,
  });
}

let activeSopModel = createSopModel(configuredModel);

const SOP_PARSER_SYSTEM_PROMPT = `
You are an expert Industrial Systems Engineer and Standard Operating Procedure (SOP) digitization specialist.
Extract the operational steps from this uploaded manual/SOP document or image.

Rules:
1. Extract all sequential maintenance or operational actions in chronological order.
2. If safety hazards, warnings, or PPE requirements are noted, capture them in the 'safety_warning' field.
3. Translate complex technical terms into simple, clear colloquial Hinglish (Hindi + English blend) for the 'instruction_text' so technicians on the factory floor can execute them effortlessly.
4. Ensure each step is actionable and distinct.
`.trim();

function isModelNotFoundError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.$metadata?.httpStatusCode;
  if (status === 404) return true;

  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('not supported for generatecontent')
  );
}

/**
 * Dynamically parses an uploaded manual (image or PDF) into a structured Mongoose Procedure
 *
 * @param base64Document - Clean base64 string of the uploaded image or document
 * @param mimeType - Document MIME type (e.g. 'image/jpeg', 'image/png', 'application/pdf')
 */
export async function generateProcedureFromSOP(
  base64Document: string,
  mimeType: string = 'image/jpeg'
): Promise<GeneratedProcedure> {
  if (!apiKey || apiKey === 'dummy-key') {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      title: 'Centrifugal Slurry Pump Inspection Protocol',
      description: 'Extracted standard operating procedure for slurry pump maintenance and seal inspection.',
      steps: [
        {
          step_number: 1,
          instruction_text: 'Main isolation valve ko band karein aur lock-out tag-out (LOTO) verify karein.',
          safety_warning: 'Ensure high-pressure line is depressurized before opening valve.',
        },
        {
          step_number: 2,
          instruction_text: 'Pump casing bolts ko inspect karein aur torque wrench se cross pattern me tighten karein.',
        },
        {
          step_number: 3,
          instruction_text: 'Bearing housing oil level gauge check karein aur leaks ke liye visually inspect karein.',
          safety_warning: 'Avoid direct contact with hot lubricant oil.',
        },
      ],
    };
  }

  // 1. Clean base64 string
  const cleanBase64 = base64Document.replace(/^data:[a-zA-Z0-9\/\-+.]+;base64,/, '');

  // 2. Construct LangChain multimodal prompt using native media part
  const messages = [
    new SystemMessage(SOP_PARSER_SYSTEM_PROMPT),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: 'Extract the operational steps from this uploaded manual/SOP. Format them sequentially. If there are safety hazards mentioned, include them in the safety_warning field. Translate complex terms into simple Hinglish for the instruction_text.',
        },
        {
          type: 'media',
          mimeType,
          data: cleanBase64,
        },
      ],
    }),
  ];

  const candidateModels = [
    configuredModel,
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ];

  const uniqueModels = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (const modelCandidate of uniqueModels) {
    try {
      const modelInstance =
        modelCandidate === configuredModel ? activeSopModel : createSopModel(modelCandidate);

      const structuredLlm = modelInstance.withStructuredOutput(generatedProcedureSchema);
      const procedure = await structuredLlm.invoke(messages);
      activeSopModel = modelInstance;
      return procedure;
    } catch (err: any) {
      lastError = err;

      if (isModelNotFoundError(err)) {
        console.warn(`[SOP Service] Model '${modelCandidate}' unavailable (${err.message}). Trying fallback...`);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('Failed to parse SOP document with Gemini');
}
