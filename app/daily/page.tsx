'use client';
import { useState, useEffect, useCallback } from 'react';
import MultipleChoice from '@/components/questions/MultipleChoice';
import TrueFalse from '@/components/questions/TrueFalse';
import TypeIn from '@/components/questions/TypeIn';
import Timer from '@/components/Timer';
import type { Question } from '@/lib/gemini';

type Phase = 'loading' | 'question' | 'revealing' | 'done';

export default function DailyPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30);

  useEffect(() => {
    fetch('/api/daily-question')
      .then((r) => r.json())
      .then((d) => {
        setQuestion(d.question);
        setPhase('question');
      })
      .catch(() => setPhase('done'));
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== 'question') return;
    const id = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          clearInterval(id);
          setPhase('revealing');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!question) return;
      const normalize = (s: string) => s.toLowerCase().trim();
      const isCorrect = normalize(answer) === normalize(String(question.correct_answer));
      setSelectedAnswer(answer);
      setCorrect(isCorrect);
      setPhase('revealing');
      fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: isCorrect ? 200 + timeRemaining * 5 : 0,
          questionsAnswered: 1,
          correctAnswers: isCorrect ? 1 : 0,
          streakMax: 0,
          mode: 'daily',
          timeSpent: 30 - timeRemaining,
        }),
      }).catch(() => {});
    },
    [question, timeRemaining]
  );

  return (
    <main
      className="min-h-screen relative flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1520 100%)' }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="font-black-ops text-4xl mb-1" style={{ color: '#F5E642' }}>
            DAILY QUESTION
          </h1>
          <p className="font-special-elite text-gray-500 text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div
          className="p-8"
          style={{
            background: 'rgba(10,10,15,0.95)',
            border: '2px solid rgba(245,230,66,0.3)',
          }}
        >
          {phase === 'loading' && (
            <p className="text-center font-special-elite text-gray-500 py-8">
              Loading today&apos;s question...
            </p>
          )}

          {(phase === 'question' || phase === 'revealing') && question && (
            <>
              <div className="flex justify-between items-center mb-6">
                <span className="font-special-elite text-xs text-gray-500 tracking-widest">
                  {question.category?.toUpperCase() || 'BASEBALL'}
                </span>
                {phase === 'question' && (
                  <Timer
                    duration={30}
                    timeRemaining={timeRemaining}
                    onTimeUp={() => setPhase('revealing')}
                    isRunning={phase === 'question'}
                  />
                )}
              </div>

              {question.type === 'multiple_choice' && question.options && (
                <MultipleChoice
                  question={question.text}
                  options={question.options}
                  onAnswer={handleAnswer}
                  disabled={phase === 'revealing'}
                  selectedAnswer={selectedAnswer ?? undefined}
                  correctAnswer={
                    phase === 'revealing' ? (question.correct_answer as string) : undefined
                  }
                />
              )}
              {question.type === 'true_false' && (
                <TrueFalse
                  question={question.text}
                  onAnswer={handleAnswer}
                  disabled={phase === 'revealing'}
                  selectedAnswer={selectedAnswer ?? undefined}
                  correctAnswer={
                    phase === 'revealing' ? (question.correct_answer as string) : undefined
                  }
                />
              )}
              {question.type !== 'multiple_choice' && question.type !== 'true_false' && (
                <TypeIn
                  question={question.text}
                  onAnswer={handleAnswer}
                  disabled={phase === 'revealing'}
                  correctAnswer={
                    phase === 'revealing' ? (question.correct_answer as string) : undefined
                  }
                  userAnswer={selectedAnswer ?? undefined}
                />
              )}

              {phase === 'revealing' && (
                <div
                  className="mt-6 p-4 fade-in"
                  style={{
                    background: correct ? 'rgba(76,175,80,0.15)' : 'rgba(255,68,68,0.15)',
                    border: `1px solid ${correct ? '#4CAF50' : '#FF4444'}40`,
                  }}
                >
                  <p
                    className="font-black-ops text-xl mb-2"
                    style={{ color: correct ? '#4CAF50' : '#FF4444' }}
                  >
                    {correct ? '✓ CORRECT!' : '✗ NOT QUITE'}
                  </p>
                  <p className="font-special-elite text-sm text-gray-300">
                    {question.explanation}
                  </p>
                </div>
              )}
            </>
          )}

          {phase === 'done' && (
            <p className="text-center font-special-elite text-gray-500 py-8">
              No question available today. Check back soon!
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
