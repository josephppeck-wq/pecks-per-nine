'use client';

interface TrueFalseProps {
  question: string;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  selectedAnswer?: string;
  correctAnswer?: string;
}

export default function TrueFalse({
  question,
  onAnswer,
  disabled,
  selectedAnswer,
  correctAnswer,
}: TrueFalseProps) {
  const options = ['True', 'False'];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="font-special-elite text-xl text-white mb-8 text-center leading-relaxed">
        {question}
      </p>
      <div className="flex gap-6 justify-center">
        {options.map((option) => {
          const isSelected = selectedAnswer === option;
          const isCorrect = correctAnswer === option;
          const isWrong = isSelected && correctAnswer && !isCorrect;

          let bg =
            option === 'True' ? 'rgba(76,175,80,0.2)' : 'rgba(255,68,68,0.2)';
          let border =
            option === 'True'
              ? '3px solid rgba(76,175,80,0.5)'
              : '3px solid rgba(255,68,68,0.5)';
          if (disabled) {
            if (isCorrect) {
              bg =
                option === 'True' ? 'rgba(76,175,80,0.5)' : 'rgba(255,68,68,0.5)';
            } else if (isWrong) {
              bg = 'rgba(50,50,50,0.5)';
              border = '3px solid #666';
            }
          }

          return (
            <button
              key={option}
              onClick={() => !disabled && onAnswer(option)}
              disabled={disabled}
              className="font-black-ops text-2xl px-12 py-6 transition-all hover:scale-105"
              style={{
                background: bg,
                border,
                color: option === 'True' ? '#4CAF50' : '#FF4444',
                cursor: disabled ? 'default' : 'pointer',
                minWidth: 140,
              }}
            >
              {option.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
