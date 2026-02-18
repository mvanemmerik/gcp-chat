import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserProfile, upsertUserProfile, getSession, saveMessage, mergeFacts } from '@/lib/firestore';
import { chatStream, extractFacts } from '@/lib/gemini';
import { Message } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = (session.user as { id?: string }).id!;
  const { message, sessionId } = await req.json();

  if (!message || !sessionId) {
    return new Response('message and sessionId required', { status: 400 });
  }

  const [userProfile, chatSession] = await Promise.all([
    getUserProfile(userId),
    getSession(userId, sessionId),
  ]);

  if (!userProfile) {
    await upsertUserProfile(userId, {
      userId,
      email: session.user.email ?? '',
      name: session.user.name ?? '',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      facts: {},
    });
  }

  const userFacts = userProfile?.facts ?? {};
  const sessionMessages = chatSession?.messages ?? [];

  const userMessage: Message = { role: 'user', content: message, timestamp: Date.now() };
  await saveMessage(userId, sessionId, userMessage);

  const encoder = new TextEncoder();
  let fullReply = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chatStream(sessionMessages, message, userFacts)) {
          fullReply += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
        }

        const assistantMessage: Message = { role: 'assistant', content: fullReply, timestamp: Date.now() };
        await saveMessage(userId, sessionId, assistantMessage);

        extractFacts(message, fullReply, userFacts)
          .then((newFacts) => {
            if (Object.keys(newFacts).length > 0) return mergeFacts(userId, newFacts);
          })
          .catch(console.error);

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
