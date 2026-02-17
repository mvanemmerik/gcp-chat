'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/ChatLayout';
import { v4 as uuidv4 } from 'uuid';

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  if (status === 'loading' || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return <ChatLayout sessionId={sessionId} onNewSession={() => setSessionId(uuidv4())} />;
}
