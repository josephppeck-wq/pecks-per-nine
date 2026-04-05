'use client';

interface MultipleChoiceProps {
  question: string;
  options: string[];
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  selectedAnswer?: string;
  correctAnswer?: string;
}

export default function MultipleChoice({
  question,
  options,
  onAnswer,
  disabled,
  selectedAnswer,
  correctAnswer,
}: MultipleChoiceProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="font-special-elite text-xl text-white mb-6 text-center leading-relaxed">
        {question}
      </p>
      <div className="grid grid-cols-1 gap-3">
        {options.map((option, i) => {
          const letters = ['A', 'B', 'C', 'D'];
          const isSelected = selectedAnswer === option;
          const isCorrect = correctAnswer === option;
          const isWrong = isSelected && correctAnswer && !isCorrect;

          let bg = 'rgba(255,255,255,0.05)';
          let border = '2px solid rgba(245,230,66,0.4)';
          if (disabled) {
            if (isCorrect) {
              bg = 'rgba(76,175,80,0.3)';
              border = '2px solid #4CAF50';
            } else if (isWrong) {
              bg = 'rgba(255,68,68,0.3)';
              border = '2px solid #FF4444';
            }
          }

          return (
            <button
              key={i}
              onClick={() => !disabled && onAnswer(option)}
              disabled={disabled}
              className="text-left p-4 transition-all hover:bg-white/10 font-special-elite"
              style={{
                background: bg,
                border,
                color: '#F5E642',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span className="font-black-ops text-lg mr-3" style={{ color: '#aaa' }}>
                {letters[i]}.
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
