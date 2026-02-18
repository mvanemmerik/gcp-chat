import { VertexAI } from '@google-cloud/vertexai';
import { Message } from '@/types';
import { GCP_TOOL_DECLARATIONS, executeTool } from './gcp-tools';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.VERTEX_AI_LOCATION ?? 'us-east1',
});

const SYSTEM_PROMPT = `You are an expert Google Cloud Platform architect and engineer. You have deep knowledge of all GCP services, best practices, pricing, and architecture patterns. You remember facts about the user and their projects to give personalized advice. Be concise, practical, and direct.

You have tools to query the user's live GCP project. Use them when the user asks about their actual resources, services, or configuration. Present results clearly and add helpful context.`;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [GCP_TOOL_DECLARATIONS, { googleSearch: {} } as any],
  });

  const history = sessionMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chatSession = model.startChat({ history });

  // First turn
  let result = await chatSession.sendMessage(newUserMessage);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let candidate = result.response.candidates?.[0] as any;

  // Tool call loop — handle all function calls in a turn together
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  while (candidate?.content?.parts?.some((p: any) => p.functionCall)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionCallParts = candidate.content.parts.filter((p: any) => p.functionCall);

    // Execute all tool calls in this turn in parallel
    const toolResults = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      functionCallParts.map(async (part: any) => {
        const { name, args } = part.functionCall;
        const toolResult = await executeTool(name, (args as Record<string, unknown>) ?? {});
        return { name, toolResult };
      })
    );

    // Send ALL responses back in one message (count must match function call count)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await chatSession.sendMessage(toolResults.map(({ name, toolResult }) => ({
      functionResponse: {
        name,
        response: { result: toolResult },
      },
    })) as any);
    candidate = result.response.candidates?.[0] as any;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return candidate?.content?.parts?.find((p: any) => p.text)?.text ?? '';
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
