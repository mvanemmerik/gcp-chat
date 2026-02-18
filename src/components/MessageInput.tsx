'use client';

import { useState, useRef, KeyboardEvent } from 'react';

const SUGGESTIONS = [
  "What's my current GCP spend?",
  "List my Cloud Run services",
  "What GCP APIs are enabled?",
  "Show my project info",
  "List my GCS buckets",
  "Show my IAM policy",
];

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
  showSuggestions?: boolean;
}

export function MessageInput({ onSend, disabled, showSuggestions }: Props) {
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

  const handleSuggestion = (s: string) => {
    onSend(s);
    textareaRef.current?.focus();
  };

  return (
    <div className="p-4 border-t border-gray-800">
      {showSuggestions && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={disabled}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
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
