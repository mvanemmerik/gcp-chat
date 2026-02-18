import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listSessionsMeta, getSession } from '@/lib/firestore';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id!;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('id');

  if (sessionId) {
    const chatSession = await getSession(userId, sessionId);
    if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(chatSession);
  }

  const sessions = await listSessionsMeta(userId);
  return NextResponse.json(sessions);
}
