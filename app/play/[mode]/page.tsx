'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import MultipleChoice from '@/components/questions/MultipleChoice';
import TrueFalse from '@/components/questions/TrueFalse';
import TypeIn from '@/components/questions/TypeIn';
import ListEntry from '@/components/questions/ListEntry';
import Timer from '@/components/Timer';
import EmailCapture from '@/components/EmailCapture';
import { getScoreboardForMode } from '@/lib/scoreboards';
import type { Question } from '@/lib/gemini';

type GamePhase = 'loading' | 'question' | 'revealing' | 'gameover';

interface GameState {
  questions: Question[];
  currentIndex: number;
  score: number;
  correctCount: number;
  streak: number;
  maxStreak: number;
  timeRemaining: number;
  phase: GamePhase;
  selectedAnswer: string | string[] | null;
  lastCorrect: boolean | null;
  pointsEarned: number;
}

const QUESTION_TIME = 30;

function checkAnswer(userAnswer: string | string[], question: Question): boolean {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (Array.isArray(question.correct_answer)) {
    if (Array.isArray(userAnswer)) {
      const correct = (question.correct_answer as string[]).map(normalize);
      const user = (userAnswer as string[]).map(normalize);
      return correct.some((c) => user.includes(c));
    }
    return (question.correct_answer as string[]).some(
      (a) => normalize(a) === normalize(userAnswer as string)
    );
  }
  return (
    normalize(question.correct_answer as string) ===
    normalize(Array.isArray(userAnswer) ? userAnswer[0] : userAnswer)
  );
}

function calcScore(difficulty: string, timeRemaining: number, streak: number): number {
  const base = difficulty === 'easy' ? 100 : difficulty === 'hard' ? 300 : 200;
  const timeBonus = timeRemaining * 5;
  const streakMult = streak >= 3 ? 1.5 : 1;
  return Math.round((base + timeBonus) * streakMult);
}

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = params.mode as string;
  const difficulty = searchParams.get('difficulty') || 'mixed';
  const totalCount = parseInt(searchParams.get('count') || '9');
  const category = searchParams.get('category') || 'all';

  const scoreboard = getScoreboardForMode(mode);
  const [imgError, setImgError] = useState(false);

  const [state, setState] = useState<GameState>({
    questions: [],
    currentIndex: 0,
    score: 0,
    correctCount: 0,
    streak: 0,
    maxStreak: 0,
    timeRemaining: QUESTION_TIME,
    phase: 'loading',
    selectedAnswer: null,
    lastCorrect: null,
    pointsEarned: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const fetchQuestion = useCallback(async (): Promise<Question | null> => {
    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: difficulty === 'mixed' ? undefined : difficulty,
          category: category === 'all' ? undefined : category,
          questionType: mode === 'sabermetrics' ? 'type_in' : undefined,
        }),
      });
      const data = await res.json();
      return (data.question as Question) || null;
    } catch {
      return null;
    }
  }, [difficulty, category, mode]);

  useEffect(() => {
    (async () => {
      const q = await fetchQuestion();
      if (q)
        setState((s) => ({ ...s, questions: [q], phase: 'question', timeRemaining: QUESTION_TIME }));
    })();
  }, [fetchQuestion]);

  // Timer
  useEffect(() => {
    if (state.phase !== 'question') return;
    timerRef.current = setInterval(() => {
      setState((s) => {
        if (s.timeRemaining <= 1) {
          clearInterval(timerRef.current!);
          return {
            ...s,
            timeRemaining: 0,
            phase: 'revealing',
            lastCorrect: false,
            selectedAnswer: null,
            pointsEarned: 0,
          };
        }
        return { ...s, timeRemaining: s.timeRemaining - 1 };
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [state.phase, state.currentIndex]);

  const handleAnswer = useCallback(
    (answer: string | string[]) => {
      clearInterval(timerRef.current!);
      setState((s) => {
        const q = s.questions[s.currentIndex];
        const correct = answer !== '' && checkAnswer(answer, q);
        const newStreak = correct ? s.streak + 1 : 0;
        const points = correct ? calcScore(q.difficulty, s.timeRemaining, newStreak) : 0;
        return {
          ...s,
          phase: 'revealing',
          selectedAnswer: answer,
          lastCorrect: correct,
          score: s.score + points,
          correctCount: s.correctCount + (correct ? 1 : 0),
          streak: newStreak,
          maxStreak: Math.max(s.maxStreak, newStreak),
          pointsEarned: points,
        };
      });
    },
    []
  );

  const handleNext = useCallback(async () => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= totalCount) {
      setState((s) => ({ ...s, phase: 'gameover' }));
      try {
        await fetch('/api/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: state.score,
            questionsAnswered: totalCount,
            correctAnswers: state.correctCount,
            streakMax: state.maxStreak,
            mode,
            timeSpent: totalCount * QUESTION_TIME - state.timeRemaining,
          }),
        });
      } catch {
        /* silent */
      }
      return;
    }

    setState((s) => ({ ...s, phase: 'loading' }));

    if (!state.questions[nextIndex]) {
      const q = await fetchQuestion();
      setState((s) => ({
        ...s,
        questions: q ? [...s.questions, q] : s.questions,
        currentIndex: nextIndex,
        phase: q ? 'question' : 'gameover',
        timeRemaining: QUESTION_TIME,
        selectedAnswer: null,
        lastCorrect: null,
      }));
    } else {
      setState((s) => ({
        ...s,
        currentIndex: nextIndex,
        phase: 'question',
        timeRemaining: QUESTION_TIME,
        selectedAnswer: null,
        lastCorrect: null,
      }));
    }
  }, [state, totalCount, mode, fetchQuestion]);

  const currentQuestion = state.questions[state.currentIndex];

  const bgStyle = imgError ? { background: scoreboard.fallbackColor } : {};

  return (
    <main className="min-h-screen relative flex flex-col" style={bgStyle}>
      {/* Background */}
      {!imgError && (
        <div className="fixed inset-0" style={{ zIndex: 0 }}>
          <Image
            src={scoreboard.imageUrl}
            alt={scoreboard.name}
            fill
            style={{ objectFit: 'cover', filter: scoreboard.filter }}
            unoptimized
            onError={() => setImgError(true)}
          />
          <div
            className="absolute inset-0"
            style={{ background: `rgba(0,0,0,${scoreboard.overlayOpacity})` }}
          />
        </div>
      )}

      <div className="relative flex flex-col min-h-screen p-4" style={{ zIndex: 1 }}>
        {/* Header — score + progress */}
        <div className="flex justify-between items-center mb-6 max-w-2xl mx-auto w-full">
          <div>
            <span className="font-special-elite text-xs text-gray-400 block">RUNS</span>
            <span className="font-black-ops text-3xl" style={{ color: '#FFD700' }}>
              {state.score.toLocaleString()}
            </span>
          </div>
          <div className="text-center">
            <span className="font-special-elite text-xs text-gray-400 block">INNING</span>
            <span className="font-black-ops text-2xl" style={{ color: '#F5E642' }}>
              {state.currentIndex + 1} / {totalCount}
            </span>
          </div>
          {state.streak >= 3 && (
            <div className="text-center">
              <span className="font-special-elite text-xs text-gray-400 block">STREAK</span>
              <span className="font-black-ops text-xl" style={{ color: '#FF8C00' }}>
                🔥 {state.streak}
              </span>
            </div>
          )}
          {state.phase === 'question' && currentQuestion && (
            <Timer
              duration={QUESTION_TIME}
              timeRemaining={state.timeRemaining}
              onTimeUp={() => handleAnswer('')}
              isRunning={state.phase === 'question'}
            />
          )}
        </div>

        {/* Game area */}
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-full max-w-2xl p-6"
            style={{
              background: 'rgba(10,10,15,0.92)',
              border: `2px solid ${scoreboard.textColor}40`,
            }}
          >
            {state.phase === 'loading' && (
              <div className="text-center py-12 font-special-elite text-gray-500">
                Loading question...
              </div>
            )}

            {(state.phase === 'question' || state.phase === 'revealing') && currentQuestion && (
              <>
                <div className="flex gap-2 mb-4 justify-between items-center">
                  <span
                    className="font-special-elite text-xs px-2 py-1"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}
                  >
                    {currentQuestion.category?.toUpperCase() || 'TRIVIA'}
                  </span>
                  <span
                    className="font-black-ops text-xs"
                    style={{
                      color:
                        currentQuestion.difficulty === 'easy'
                          ? '#4CAF50'
                          : currentQuestion.difficulty === 'hard'
                          ? '#FF4444'
                          : '#FF8C00',
                    }}
                  >
                    {currentQuestion.difficulty?.toUpperCase()}
                  </span>
                </div>

                {currentQuestion.type === 'multiple_choice' && (
                  <MultipleChoice
                    question={currentQuestion.text}
                    options={currentQuestion.options || []}
                    onAnswer={handleAnswer}
                    disabled={state.phase === 'revealing'}
                    selectedAnswer={state.selectedAnswer as string}
                    correctAnswer={
                      state.phase === 'revealing'
                        ? (currentQuestion.correct_answer as string)
                        : undefined
                    }
                  />
                )}
                {currentQuestion.type === 'true_false' && (
                  <TrueFalse
                    question={currentQuestion.text}
                    onAnswer={handleAnswer}
                    disabled={state.phase === 'revealing'}
                    selectedAnswer={state.selectedAnswer as string}
                    correctAnswer={
                      state.phase === 'revealing'
                        ? (currentQuestion.correct_answer as string)
                        : undefined
                    }
                  />
                )}
                {currentQuestion.type === 'type_in' && (
                  <TypeIn
                    question={currentQuestion.text}
                    onAnswer={handleAnswer}
                    disabled={state.phase === 'revealing'}
                    correctAnswer={
                      state.phase === 'revealing'
                        ? (currentQuestion.correct_answer as string)
                        : undefined
                    }
                    userAnswer={state.selectedAnswer as string}
                  />
                )}
                {currentQuestion.type === 'list_entry' && (
                  <ListEntry
                    question={currentQuestion.text}
                    onAnswer={(a) => handleAnswer(a)}
                    disabled={state.phase === 'revealing'}
                    correctAnswers={
                      state.phase === 'revealing'
                        ? (currentQuestion.correct_answer as string[])
                        : undefined
                    }
                    userAnswers={state.selectedAnswer as string[]}
                  />
                )}

                {state.phase === 'revealing' && (
                  <div className="mt-6 fade-in">
                    <div
                      className="p-4 mb-4"
                      style={{
                        background: state.lastCorrect
                          ? 'rgba(76,175,80,0.15)'
                          : 'rgba(255,68,68,0.15)',
                        border: `1px solid ${state.lastCorrect ? '#4CAF50' : '#FF4444'}40`,
                      }}
                    >
                      <p
                        className="font-black-ops text-lg mb-1"
                        style={{ color: state.lastCorrect ? '#4CAF50' : '#FF4444' }}
                      >
                        {state.lastCorrect
                          ? `✓ CORRECT! +${state.pointsEarned} RUNS`
                          : '✗ WRONG'}
                      </p>
                      <p className="font-special-elite text-sm text-gray-300">
                        {currentQuestion.explanation}
                      </p>
                    </div>
                    <button onClick={handleNext} className="ticket-stub w-full text-center">
                      {state.currentIndex + 1 >= totalCount
                        ? 'FINAL SCORECARD →'
                        : 'NEXT PITCH →'}
                    </button>
                  </div>
                )}
              </>
            )}

            {state.phase === 'gameover' && !showEmail && (
              <div className="text-center py-6 fade-in">
                <h2 className="font-black-ops text-4xl mb-2" style={{ color: '#FFD700' }}>
                  FINAL SCORE
                </h2>
                <p className="font-black-ops text-6xl mb-4" style={{ color: '#F5E642' }}>
                  {state.score.toLocaleString()}
                </p>
                <p className="font-special-elite text-lg text-gray-300 mb-2">
                  {state.correctCount} / {totalCount} correct
                </p>
                {state.maxStreak >= 3 && (
                  <p className="font-special-elite text-sm text-orange-400 mb-4">
                    Best streak: {state.maxStreak} 🔥
                  </p>
                )}
                <div className="flex gap-4 justify-center mt-6">
                  <button onClick={() => setShowEmail(true)} className="ticket-stub">
                    SEND SCORECARD
                  </button>
                  <button
                    onClick={() => router.push('/play')}
                    className="ticket-stub ticket-stub-secondary"
                  >
                    PLAY AGAIN
                  </button>
                </div>
              </div>
            )}

            {state.phase === 'gameover' && showEmail && (
              <EmailCapture
                score={state.score}
                correctAnswers={state.correctCount}
                totalQuestions={totalCount}
                mode={mode}
                onSent={() => setTimeout(() => router.push('/leaderboard'), 2000)}
                onSkip={() => router.push('/leaderboard')}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
