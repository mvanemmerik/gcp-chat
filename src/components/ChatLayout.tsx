'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Message } from '@/types';

interface Props {
  sessionId: string;
  onNewSession: () => void;
}

function greeting(name: string | null | undefined): Message {
  const firstName = name?.split(' ')[0] ?? 'there';
  return {
    role: 'assistant',
    content: `Hey ${firstName}! I'm your GCP expert. What are we building today? 🚀`,
    timestamp: Date.now(),
  };
}

export function ChatLayout({ sessionId, onNewSession }: Props) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>(() => [greeting(session?.user?.name)]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (text: string) => {
    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <div className="w-64 bg-gray-900 flex flex-col p-4 gap-4 border-r border-gray-800">
        <h2 className="text-lg font-semibold">GCP Chatbot</h2>
        <button
          onClick={() => { setMessages([greeting(session?.user?.name)]); onNewSession(); }}
          className="w-full py-2 px-4 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Chat
        </button>
        <div className="flex-1" />
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full py-2 px-4 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
        >
          Sign Out
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <MessageList messages={messages} loading={loading} />
        <MessageInput onSend={handleSend} disabled={loading} showSuggestions={messages.length <= 1} />
      </div>
    </div>
  );
}
