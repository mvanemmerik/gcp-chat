'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types';

interface Props {
  messages: Message[];
  loading: boolean;
}

export function MessageList({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : msg.role === 'error' as string
                ? 'bg-red-900/60 text-red-300 border border-red-700'
                : 'bg-gray-800 text-gray-100'
            }`}
          >
            {msg.role === 'user' ? (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const isBlock = className?.includes('language-');
                    return isBlock ? (
                      <pre className="bg-gray-900 rounded-lg p-3 overflow-x-auto my-2 text-xs">
                        <code className={className} {...props}>{children}</code>
                      </pre>
                    ) : (
                      <code className="bg-gray-900 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
                  ul({ children }) { return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>; },
                  ol({ children }) { return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>; },
                  li({ children }) { return <li className="leading-relaxed">{children}</li>; },
                  h1({ children }) { return <h1 className="text-base font-bold mb-2">{children}</h1>; },
                  h2({ children }) { return <h2 className="text-sm font-bold mb-1">{children}</h2>; },
                  h3({ children }) { return <h3 className="text-sm font-semibold mb-1">{children}</h3>; },
                  a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{children}</a>; },
                  table({ children }) { return <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>; },
                  th({ children }) { return <th className="border border-gray-600 px-2 py-1 bg-gray-700 text-left font-semibold">{children}</th>; },
                  td({ children }) { return <td className="border border-gray-600 px-2 py-1">{children}</td>; },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
