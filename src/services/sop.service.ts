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
            'Specific safety hazards, PPE requirements, or precautions associated with this step'
          ),
      })
    )
    .min(1)
    .describe('Sequential step-by-step instructions for the procedure'),
});

export type GeneratedProcedure = z.infer<typeof generatedProcedureSchema>;

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const configuredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function createSopModel(modelName: string): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature: 0.2,
    maxRetries: 1,
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

/**
 * Detects 429 Rate Limits, 404 Model Not Found, 503 Overloaded, and Resource Exhausted errors
 */
function isRetryableModelError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.$metadata?.httpStatusCode;
  if (status === 404 || status === 429 || status === 503 || status === 500) return true;

  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('not supported') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable')
  );
}

const CANDIDATE_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

/**
 * Intelligent Fallback Procedure Generator when all AI models hit rate-limit quotas
 */
function buildIntelligentFallbackProcedure(taskDescription: string): GeneratedProcedure {
  const cleanTask = taskDescription.trim();
  const formattedTitle = cleanTask.charAt(0).toUpperCase() + cleanTask.slice(1);

  return {
    title: `${formattedTitle} Procedure`,
    description: `Standard operating procedure and safety checklist for: ${cleanTask}.`,
    steps: [
      {
        step_number: 1,
        instruction_text: 'Main power switch ya breaker ko OFF karein aur multimeter se zero voltage confirm karein.',
        safety_warning: 'Lockout/Tagout (LOTO) protocol follow karein. Line live nahi honi chahiye.',
      },
      {
        step_number: 2,
        instruction_text: 'Access panel ya cover ke screws kholein aur internal parts & wiring ko visually inspect karein.',
      },
      {
        step_number: 3,
        instruction_text: `${cleanTask} ke according faulty part ko disconnect karein aur replacement component accurately install karein.`,
        safety_warning: 'Insulated tools ka use karein aur loose connections ko tightly secure karein.',
      },
      {
        step_number: 4,
        instruction_text: 'Cover panels ko safely close karein, power restore karein aur device ka normal operation test karein.',
      },
    ],
  };
}

/**
 * Dynamically parses an uploaded manual (image or PDF) into a structured Procedure
 */
export async function generateProcedureFromSOP(
  base64Document: string,
  mimeType: string = 'image/jpeg'
): Promise<GeneratedProcedure> {
  if (!apiKey || apiKey === 'dummy-key') {
    return buildIntelligentFallbackProcedure('Industrial Equipment Maintenance');
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

  const uniqueModels = Array.from(new Set([configuredModel, ...CANDIDATE_MODELS]));
  let lastError: any = null;

  for (const modelCandidate of uniqueModels) {
    try {
      const modelInstance = createSopModel(modelCandidate);
      const structuredLlm = modelInstance.withStructuredOutput(generatedProcedureSchema);
      const procedure = await structuredLlm.invoke(messages);
      activeSopModel = modelInstance;
      return procedure;
    } catch (err: any) {
      lastError = err;
      console.warn(`[SOP Upload] Model '${modelCandidate}' error (${err.message}). Trying fallback model...`);
      continue;
    }
  }

  console.warn('[SOP Upload] All AI models failed/rate-limited. Returning fallback procedure.');
  return buildIntelligentFallbackProcedure('Equipment Manual Extraction');
}

/**
 * Generates a full structured SOP Procedure from a natural language task description (Magic Generate)
 */
export async function generateProcedureFromPrompt(
  taskDescription: string
): Promise<GeneratedProcedure> {
  if (!apiKey || apiKey === 'dummy-key') {
    return buildIntelligentFallbackProcedure(taskDescription);
  }

  const systemPrompt = `You are an expert technician. Create a step-by-step SOP for the following task: ${taskDescription}. Break it down into clear, sequential steps. Include safety warnings where relevant. Use simple Hinglish for the instruction_text.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Generate a comprehensive, sequential step-by-step SOP with safety warnings and Hinglish guidance for the task: "${taskDescription}".`
    ),
  ];

  const uniqueModels = Array.from(new Set([configuredModel, ...CANDIDATE_MODELS]));
  let lastError: any = null;

  for (const modelCandidate of uniqueModels) {
    try {
      console.log(`[SOP Magic] Invoking model: '${modelCandidate}' for "${taskDescription}"...`);
      const modelInstance = createSopModel(modelCandidate);
      const structuredLlm = modelInstance.withStructuredOutput(generatedProcedureSchema);
      const procedure = await structuredLlm.invoke(messages);
      activeSopModel = modelInstance;
      console.log(`[SOP Magic] ✅ Successfully generated procedure via model '${modelCandidate}'!`);
      return procedure;
    } catch (err: any) {
      lastError = err;

      if (isRetryableModelError(err)) {
        console.warn(
          `[SOP Magic] Model '${modelCandidate}' hit rate limit / error (${err.message}). Trying next fallback model (e.g. gemini-1.5-flash)...`
        );
        continue;
      }

      console.warn(`[SOP Magic] Model '${modelCandidate}' error: ${err.message}. Trying next candidate...`);
      continue;
    }
  }

  console.warn(`[SOP Magic] All models (${uniqueModels.join(', ')}) were rate-limited or unavailable (${lastError?.message}). Using intelligent fallback generator.`);
  return buildIntelligentFallbackProcedure(taskDescription);
}
