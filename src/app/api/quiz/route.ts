import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VertexAI } from '@google-cloud/vertexai';

const TOPICS = [
  'Fundamentals of Generative AI: how gen AI models work, ML approaches (supervised, unsupervised, reinforcement learning), foundation models, LLMs, multimodal models, diffusion models, data types and data preparation',
  'Google Cloud GCP AI Offerings: Vertex AI, Model Garden, Gemini models, Gemma open models, Imagen, Veo, Agent Builder, Grounding, RAG on Vertex, fine-tuning, BigQuery ML',
  'Model Output Quality and Evaluation: prompt engineering techniques, temperature settings, hallucination and grounding, RAG for factual accuracy, evaluation metrics, responsible AI principles, bias and safety filters',
  'Business Strategy and ROI for Generative AI: build vs buy decisions, total cost of ownership, change management, identifying high-value AI use cases, measuring business impact, governance and data privacy',
  'Real-world Google Cloud Gen AI Use Cases: customer service agents, document processing and summarization, code generation with Gemini, enterprise search, content creation, contact center AI, retail and healthcare applications',
];

export interface QuizQuestion {
  q: string;
  options: [string, string, string, string];
  correct: number;
  explanations: [string, string, string, string];
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  const prompt =
    'You are an expert question writer for the Google Cloud Generative AI Leader certification exam. ' +
    `Generate one unique, challenging multiple-choice exam question about this topic: ${topic}. ` +
    'The question should be scenario-based (set in a business context), like the real exam. ' +
    'Each wrong option must have a plausible but clearly incorrect reason. ' +
    'Return ONLY valid JSON in exactly this format: ' +
    '{"q":"question text","options":["option A text","option B text","option C text","option D text"],' +
    '"correct":2,"explanations":["explanation for A","explanation for B","explanation for C","explanation for D"]} ' +
    'where correct is the 0-based index of the correct option. ' +
    'Each explanation must start with the letter label (e.g. "A is correct because..."). ' +
    'Make exactly 4 options. Do not include labels like A) or 1) inside the option text itself.';

  try {
    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT!,
      location: process.env.VERTEX_AI_LOCATION ?? 'us-east1',
    });

    const model = vertexAI.getGenerativeModel({
      model: process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.0-flash-001',
    });

    const result = await model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const q: QuizQuestion = JSON.parse(cleaned);

    if (
      !q.q ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.correct !== 'number' ||
      !Array.isArray(q.explanations) ||
      q.explanations.length !== 4
    ) {
      return new Response('Invalid question format from model', { status: 500 });
    }

    return Response.json(q);
  } catch (err) {
    console.error('Quiz generation error:', err);
    return new Response('Failed to generate question', { status: 500 });
  }
}
