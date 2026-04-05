'use client';
import { useState } from 'react';

interface ListEntryProps {
  question: string;
  onAnswer: (answers: string[]) => void;
  disabled?: boolean;
  correctAnswers?: string[];
  userAnswers?: string[];
  minEntries?: number;
}

export default function ListEntry({
  question,
  onAnswer,
  disabled,
  correctAnswers,
  userAnswers,
  minEntries = 3,
}: ListEntryProps) {
  const [entries, setEntries] = useState<string[]>(Array(minEntries).fill(''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = entries.filter((entry) => entry.trim());
    if (!disabled && filled.length > 0) onAnswer(filled);
  };

  const displayEntries = disabled ? userAnswers ?? entries : entries;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="font-special-elite text-xl text-white mb-6 text-center leading-relaxed">
        {question}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
        {displayEntries.map((entry, i) => (
          <input
            key={i}
            type="text"
            value={entry}
            onChange={(e) => {
              if (!disabled) {
                const next = [...entries];
                next[i] = e.target.value;
                setEntries(next);
              }
            }}
            disabled={disabled}
            placeholder={`Entry ${i + 1}`}
            className="w-full max-w-md px-4 py-2 font-special-elite text-base"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '2px solid rgba(245,230,66,0.4)',
              color: '#F5E642',
              outline: 'none',
            }}
          />
        ))}
        {disabled && correctAnswers && (
          <div className="mt-2 text-center">
            <p className="font-special-elite text-sm text-gray-400 mb-1">Correct answers:</p>
            {correctAnswers.map((a, i) => (
              <p key={i} className="font-special-elite text-sm" style={{ color: '#4CAF50' }}>
                {a}
              </p>
            ))}
          </div>
        )}
        {!disabled && (
          <button type="submit" className="ticket-stub mt-2">
            SUBMIT
          </button>
        )}
      </form>
    </div>
  );
}
