'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuizQuestion } from '@/app/api/quiz/route';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

interface Props {
  onClose: () => void;
}

export function QuizModal({ onClose }: Props) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuestion(null);
    setChosen(null);

    try {
      const res = await fetch('/api/quiz', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const q: QuizQuestion = await res.json();
      setQuestion(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate question');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuestion(); }, [fetchQuestion]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAnswer = (idx: number) => {
    if (chosen !== null) return;
    setChosen(idx);
  };

  const optionClass = (idx: number) => {
    const base = 'flex items-start gap-3 w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors';
    if (chosen === null) return `${base} border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-600 text-white cursor-pointer`;
    if (idx === question!.correct) return `${base} border-green-500 bg-green-900/40 text-green-300 cursor-default`;
    if (idx === chosen) return `${base} border-red-500 bg-red-900/40 text-red-300 cursor-default`;
    return `${base} border-gray-700 bg-gray-800/50 text-gray-500 cursor-default`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              AI Practice Question
            </span>
            <span className="text-xs text-gray-500">Gen AI Leader Exam</span>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <button
                onClick={fetchQuestion}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Generate Another
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-lg leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              Generating question…
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={fetchQuestion}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-white transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {question && !loading && (
            <>
              <p className="text-white text-sm font-medium leading-relaxed mb-5">{question.q}</p>

              <div className="flex flex-col gap-2 mb-5">
                {question.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className={optionClass(idx)}
                    onClick={() => handleAnswer(idx)}
                    disabled={chosen !== null}
                  >
                    <span className="font-bold text-xs shrink-0 mt-0.5 w-4">{LETTERS[idx]}</span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>

              {/* Feedback panel */}
              {chosen !== null && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Feedback</p>
                  <div className="flex flex-col gap-2">
                    {question.explanations.map((exp, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 text-xs leading-relaxed ${
                          idx === question.correct
                            ? 'text-green-400'
                            : idx === chosen
                            ? 'text-red-400'
                            : 'text-gray-500'
                        }`}
                      >
                        <span className="font-bold shrink-0 w-3">{LETTERS[idx]}</span>
                        <span>{exp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex gap-3">
                <button
                  onClick={fetchQuestion}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all"
                >
                  Generate Another Question
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
