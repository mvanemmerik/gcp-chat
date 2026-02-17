import { VertexAI } from '@google-cloud/vertexai';
import { Message } from '@/types';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.VERTEX_AI_LOCATION ?? 'us-east1',
});

const SYSTEM_PROMPT = `You are an expert Google Cloud Platform architect and engineer. You have deep knowledge of all GCP services, best practices, pricing, and architecture patterns. You remember facts about the user and their projects to give personalized advice. Be concise, practical, and direct.`;

export function buildSystemPromptWithMemory(facts: Record<string, unknown>): string {
  const factLines = Object.entries(facts)
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join('\n');

  if (!factLines) return SYSTEM_PROMPT;

  return `${SYSTEM_PROMPT}\n\nWhat you know about the user:\n${factLines}`;
}

export async function chat(
  sessionMessages: Message[],
  newUserMessage: string,
  userFacts: Record<string, unknown>
): Promise<string> {
  const model = vertexAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-001',
    systemInstruction: buildSystemPromptWithMemory(userFacts),
  });

  const history = sessionMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chatSession = model.startChat({ history });
  const result = await chatSession.sendMessage(newUserMessage);
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function extractFacts(
  userMessage: string,
  assistantReply: string,
  existingFacts: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const flashModel = vertexAI.getGenerativeModel({
    model: process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.0-flash-001',
  });

  const prompt = `You extract personal facts about the user from conversations to help a GCP assistant remember them.

Existing known facts (JSON):
${JSON.stringify(existingFacts, null, 2)}

New conversation:
User: ${userMessage}
Assistant: ${assistantReply}

Extract any NEW facts about the user (their GCP projects, preferred services, tech stack, goals, preferences, etc.) that aren't already captured. Return ONLY a valid JSON object of new/updated facts, or {} if nothing new. Do not repeat existing facts unless they changed.

JSON only, no explanation:`;

  const result = await flashModel.generateContent(prompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}
