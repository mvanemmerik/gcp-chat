import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserProfile, upsertUserProfile, getSession, saveMessage, mergeFacts } from '@/lib/firestore';
import { chat, extractFacts } from '@/lib/gemini';
import { Message } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id!;
  const { message, sessionId } = await req.json();

  if (!message || !sessionId) {
    return NextResponse.json({ error: 'message and sessionId required' }, { status: 400 });
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

  const userMessage: Message = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
  };
  await saveMessage(userId, sessionId, userMessage);

  const reply = await chat(sessionMessages, message, userFacts);

  const assistantMessage: Message = {
    role: 'assistant',
    content: reply,
    timestamp: Date.now(),
  };
  await saveMessage(userId, sessionId, assistantMessage);

  // Fire-and-forget fact extraction
  extractFacts(message, reply, userFacts)
    .then((newFacts) => {
      if (Object.keys(newFacts).length > 0) {
        return mergeFacts(userId, newFacts);
      }
    })
    .catch(console.error);

  return NextResponse.json({ reply, sessionId });
}
