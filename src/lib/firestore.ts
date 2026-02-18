import { Firestore, FieldValue } from '@google-cloud/firestore';
import { UserProfile, ChatSession, Message } from '@/types';

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const USERS_COLLECTION = 'user_profiles';
const SESSIONS_COLLECTION = 'chat_sessions';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
  if (!doc.exists) return null;
  return doc.data() as UserProfile;
}

export async function upsertUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .set({ ...data, lastUpdated: Date.now() }, { merge: true });
}

export async function mergeFacts(
  userId: string,
  newFacts: Record<string, unknown>
): Promise<void> {
  const profile = await getUserProfile(userId);
  const existingFacts = profile?.facts ?? {};
  await upsertUserProfile(userId, {
    facts: { ...existingFacts, ...newFacts },
  });
}

export async function getSession(
  userId: string,
  sessionId: string
): Promise<ChatSession | null> {
  const doc = await db
    .collection(SESSIONS_COLLECTION)
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .get();
  if (!doc.exists) return null;
  return doc.data() as ChatSession;
}

export async function saveMessage(
  userId: string,
  sessionId: string,
  message: Message
): Promise<void> {
  const ref = db
    .collection(SESSIONS_COLLECTION)
    .doc(userId)
    .collection('sessions')
    .doc(sessionId);

  const doc = await ref.get();
  if (!doc.exists) {
    const title = message.content.slice(0, 50).trim() + (message.content.length > 50 ? '…' : '');
    await ref.set({
      sessionId,
      title,
      createdAt: Date.now(),
      messages: [message],
    });
  } else {
    await ref.update({
      messages: FieldValue.arrayUnion(message),
    });
  }
}

export async function listSessionsMeta(
  userId: string
): Promise<Array<{ sessionId: string; title: string; createdAt: number }>> {
  const snapshot = await db
    .collection(SESSIONS_COLLECTION)
    .doc(userId)
    .collection('sessions')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .select('sessionId', 'title', 'createdAt')
    .get();
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      sessionId: data.sessionId as string,
      title: (data.title as string) ?? 'Untitled',
      createdAt: data.createdAt as number,
    };
  });
}

export async function listSessions(userId: string): Promise<ChatSession[]> {
  const snapshot = await db
    .collection(SESSIONS_COLLECTION)
    .doc(userId)
    .collection('sessions')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  return snapshot.docs.map((d) => d.data() as ChatSession);
}
