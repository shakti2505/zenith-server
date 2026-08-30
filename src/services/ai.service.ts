import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Strict Response Schema for Industrial AI Visual Inspection
 */
export const visualStepEvaluationSchema = z.object({
  status: z
    .enum(['COMPLETED', 'IN_PROGRESS', 'HAZARD', 'INVALID_VIEW', 'IMAGE_UNCLEAR'])
    .describe('Evaluation status of the equipment inspection step, safety hazard warning, invalid view, or blurry/unclear image detection'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0 based on visual clarity and SOP compliance'),
  feedback_hinglish: z
    .string()
    .describe(
      'Short, colloquial Hinglish voice instruction (under 12 words) guiding the industrial technician (e.g. "Done, agla step karo." or "Warning, safety valve open hai! Band karo." or "Camera ko machine ki taraf point karein." or "Photo dhundhli hai, phone thoda peeche karein.")'
    ),
});

export type VisualStepEvaluation = z.infer<typeof visualStepEvaluationSchema>;

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/**
 * Factory to create official ChatGoogleGenerativeAI model instance
 */
function createVisionModel(modelName: string): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature: 0.2,
    maxRetries: 2,
  });
}

let activeVisionModel = createVisionModel(configuredModel);

const DEFAULT_INDUSTRIAL_SYSTEM_PROMPT = `
You are Zenith Industrial Copilot, an expert computer vision assistant for field technicians.
Analyze the provided camera frame from an industrial maintenance inspection against the standard operating procedure (SOP).

Rules:
1. Verify if the technician has correctly executed the step (e.g., valve tightened, flange aligned, oil level checked).
2. If safety hazard or oil leak or danger is detected, return status "HAZARD" with urgent warning feedback.
3. If step is completed successfully, return status "COMPLETED" with positive guidance.
4. If step is still being performed, return status "IN_PROGRESS".
5. If the image does not contain the relevant equipment, tools, or hands working on the task (e.g., it shows a floor, ceiling, or completely unrelated scene), return status as INVALID_VIEW with feedback like "Camera ko machine ki taraf point karein".
6. If the image is too blurry, out of focus, or too dark to confidently evaluate the step, return status as IMAGE_UNCLEAR with feedback like "Photo dhundhli hai, phone thoda peeche karein.".
7. Always provide 'feedback_hinglish' as concise, natural Hindi-English blend spoken instructions.
`.trim();

/**
 * Helper to identify whether an error is specifically due to model availability / not-found
 */
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
 * Evaluate an industrial visual inspection step using LangChain + Gemini
 *
 * @param base64Image - Raw or data-URI base64 encoded image frame
 * @param systemPrompt - Optional customized SOP context for the current step
 */
export async function evaluateVisualStep(
  base64Image: string,
  systemPrompt?: string
): Promise<VisualStepEvaluation> {
  // Graceful development fallback if API key is not configured
  if (!apiKey || apiKey === 'dummy-key') {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      status: 'COMPLETED',
      confidence: 0.95,
      feedback_hinglish: 'Done, agla step karo.',
    };
  }

  // 1. Normalize image to raw base64 data
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // 2. Construct LangChain multimodal messages using native 'media' content part
  // ('media' directly produces inlineData without triggering client-side model name regex validation)
  const messages = [
    new SystemMessage(systemPrompt || DEFAULT_INDUSTRIAL_SYSTEM_PROMPT),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: 'Inspect this live equipment frame. Evaluate the step status and provide real-time voice feedback in Hinglish.',
        },
        {
          type: 'media',
          mimeType: 'image/jpeg',
          data: cleanBase64,
        },
      ],
    }),
  ];

  // 3. Fallback candidates limited to active supported Gemini models
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
        modelCandidate === configuredModel ? activeVisionModel : createVisionModel(modelCandidate);

      const structuredLlm = modelInstance.withStructuredOutput(visualStepEvaluationSchema);
      const result = await structuredLlm.invoke(messages);
      activeVisionModel = modelInstance;
      return result;
    } catch (err: any) {
      lastError = err;

      // Only fall back on model availability / not-found errors (404, unsupported model)
      if (isModelNotFoundError(err)) {
        console.warn(`[AI Service] Model '${modelCandidate}' unavailable (${err.message}). Trying fallback...`);
        continue;
      }

      // Re-throw immediately on auth (401/403), quota/rate-limit (429), validation, or other errors
      throw err;
    }
  }

  throw lastError || new Error('Failed to evaluate visual step with Gemini');
}
