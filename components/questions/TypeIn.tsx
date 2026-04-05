'use client';
import { useState } from 'react';

interface TypeInProps {
  question: string;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  correctAnswer?: string;
  userAnswer?: string;
}

export default function TypeIn({
  question,
  onAnswer,
  disabled,
  correctAnswer,
  userAnswer,
}: TypeInProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && value.trim()) {
      onAnswer(value.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="font-special-elite text-xl text-white mb-8 text-center leading-relaxed">
        {question}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
        <input
          type="text"
          value={disabled ? userAnswer ?? value : value}
          onChange={(e) => !disabled && setValue(e.target.value)}
          disabled={disabled}
          placeholder="Type your answer..."
          className="w-full max-w-md px-4 py-3 font-special-elite text-lg text-center"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: disabled
              ? `2px solid ${correctAnswer ? '#4CAF50' : '#FF4444'}`
              : '2px solid rgba(245,230,66,0.6)',
            color: '#F5E642',
            outline: 'none',
          }}
          autoFocus={!disabled}
        />
        {disabled && correctAnswer && (
          <p className="font-special-elite text-sm" style={{ color: '#4CAF50' }}>
            Answer: {correctAnswer}
          </p>
        )}
        {!disabled && (
          <button
            type="submit"
            disabled={!value.trim()}
            className="ticket-stub px-8 py-3 text-base disabled:opacity-50"
          >
            SUBMIT
          </button>
        )}
      </form>
    </div>
  );
}
