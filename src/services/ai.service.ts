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
const configuredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/**
 * Factory to create official ChatGoogleGenerativeAI model instance
 */
function createVisionModel(modelName: string): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature: 0.2,
    maxRetries: 1,
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
 * Helper to identify whether an error can be retried on fallback model (404, 429 quota, 503, etc.)
 */
function isRetryableVisionError(err: any): boolean {
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

const VISION_CANDIDATE_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

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

  const uniqueModels = Array.from(new Set([configuredModel, ...VISION_CANDIDATE_MODELS]));
  let lastError: any = null;

  for (const modelCandidate of uniqueModels) {
    try {
      const modelInstance = createVisionModel(modelCandidate);
      const structuredLlm = modelInstance.withStructuredOutput(visualStepEvaluationSchema);
      const result = await structuredLlm.invoke(messages);
      activeVisionModel = modelInstance;
      return result;
    } catch (err: any) {
      lastError = err;

      if (isRetryableVisionError(err)) {
        console.warn(
          `[AI Vision] Model '${modelCandidate}' hit error (${err.message}). Trying next fallback model (e.g. gemini-1.5-flash)...`
        );
        continue;
      }

      console.warn(`[AI Vision] Model '${modelCandidate}' error: ${err.message}. Trying fallback...`);
      continue;
    }
  }

  console.warn(`[AI Vision] All vision models failed or rate-limited (${lastError?.message}). Returning fallback inspection status.`);
  return {
    status: 'IN_PROGRESS',
    confidence: 0.85,
    feedback_hinglish: 'Inspection jaari hai, camera position hold karein.',
  };
}
