'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-gray-800">
      <div className="flex gap-3 items-end bg-gray-900 rounded-xl p-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about GCP... (Enter to send, Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-white text-sm placeholder-gray-500 max-h-40"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
