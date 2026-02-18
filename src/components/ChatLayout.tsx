'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Message } from '@/types';

interface SessionMeta {
  sessionId: string;
  title: string;
  createdAt: number;
}

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
  const [sessionHistory, setSessionHistory] = useState<SessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState(sessionId);

  const fetchSessionHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) setSessionHistory(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchSessionHistory(); }, [fetchSessionHistory]);

  const handleSend = async (text: string) => {
    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: activeSessionId }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') {
            fetchSessionHistory();
            break;
          }
          try {
            const { chunk, error } = JSON.parse(raw);
            if (error) throw new Error(error);
            if (chunk) {
              if (firstChunk) {
                firstChunk = false;
                setLoading(false);
                setMessages((prev) => [...prev, { role: 'assistant', content: chunk, timestamp: Date.now() }]);
              } else {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  next[next.length - 1] = { ...last, content: last.content + chunk };
                  return next;
                });
              }
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessages((prev) => [...prev, {
        role: 'error' as Message['role'],
        content: 'Something went wrong. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setMessages([greeting(session?.user?.name)]);
    onNewSession();
    const newId = crypto.randomUUID();
    setActiveSessionId(newId);
  };

  const handleSelectSession = async (meta: SessionMeta) => {
    try {
      const res = await fetch(`/api/sessions?id=${meta.sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveSessionId(meta.sessionId);
      setMessages([greeting(session?.user?.name), ...(data.messages ?? [])]);
    } catch { /* silent */ }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 flex flex-col p-4 gap-3 border-r border-gray-800 overflow-hidden">
        <h2 className="text-lg font-semibold shrink-0">GCP Chatbot</h2>
        <button
          onClick={handleNewSession}
          className="w-full py-2 px-4 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
        >
          + New Chat
        </button>

        {/* Session history */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
          {sessionHistory.map((s) => (
            <button
              key={s.sessionId}
              onClick={() => handleSelectSession(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                s.sessionId === activeSessionId
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={s.title}
            >
              {s.title}
            </button>
          ))}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full py-2 px-4 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm shrink-0"
        >
          Sign Out
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <MessageList messages={messages} loading={loading} />
        <MessageInput
          onSend={handleSend}
          disabled={loading}
          showSuggestions={messages.length <= 1}
        />
      </div>
    </div>
  );
}
