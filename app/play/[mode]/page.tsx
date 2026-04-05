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

  // ── Core game state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1); // 1-based, for display

  // Score/streak state (not used in async closures — read from refs for submit)
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showEmail, setShowEmail] = useState(false);

  // ── Refs: always-current values for use inside async callbacks ───────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedQuestionsRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const maxStreakRef = useRef(0);
  const questionNumberRef = useRef(1);
  const isFetchingRef = useRef(false); // guard against double-fetch

  // ── Fetch a new question ─────────────────────────────────────────────────────
  const fetchQuestion = useCallback(async (): Promise<Question | null> => {
    const isSabermetrics = mode === 'sabermetrics';
    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: isSabermetrics ? 'hard' : difficulty === 'mixed' ? undefined : difficulty,
          category: category === 'all' ? undefined : category,
          questionType: isSabermetrics ? 'type_in' : undefined,
          era: isSabermetrics ? 'sabermetrics' : undefined,
          usedQuestions: usedQuestionsRef.current,
        }),
      });
      const data = await res.json();
      return (data.question as Question) || null;
    } catch {
      return null;
    }
  }, [difficulty, category, mode]);

  // ── Load first question on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = await fetchQuestion();
      if (!cancelled && q) {
        setCurrentQuestion(q);
        setPhase('question');
        setTimeRemaining(QUESTION_TIME);
      }
    })();
    return () => { cancelled = true; };
    // fetchQuestion is stable (deps are URL params that don't change mid-game)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Timer ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'question') return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          // Time's up — treat as wrong answer
          handleTimeUp();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.id]); // re-arm timer when question changes

  // ── Time-up handler (separate to avoid stale closure in timer) ───────────────
  const handleTimeUp = useCallback(() => {
    setPhase('revealing');
    setSelectedAnswer(null);
    setLastCorrect(false);
    setPointsEarned(0);
    setStreak(0);
    // Track the question as used even on timeout
    if (currentQuestion && !usedQuestionsRef.current.includes(currentQuestion.text)) {
      usedQuestionsRef.current = [...usedQuestionsRef.current, currentQuestion.text];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  // ── Answer handler ───────────────────────────────────────────────────────────
  const handleAnswer = useCallback(
    (answer: string | string[]) => {
      if (!currentQuestion || phase !== 'question') return;
      clearInterval(timerRef.current!);

      // Track used question to prevent repeats
      if (!usedQuestionsRef.current.includes(currentQuestion.text)) {
        usedQuestionsRef.current = [...usedQuestionsRef.current, currentQuestion.text];
      }

      const correct = answer !== '' && checkAnswer(answer, currentQuestion);

      setStreak((s) => {
        const newStreak = correct ? s + 1 : 0;
        setMaxStreak((ms) => {
          const newMax = Math.max(ms, newStreak);
          maxStreakRef.current = newMax;
          return newMax;
        });
        return newStreak;
      });

      const points = correct
        ? calcScore(currentQuestion.difficulty, timeRemaining, streak + (correct ? 1 : 0))
        : 0;

      setScore((s) => { scoreRef.current = s + points; return s + points; });
      setCorrectCount((c) => { correctCountRef.current = c + (correct ? 1 : 0); return c + (correct ? 1 : 0); });
      setSelectedAnswer(answer);
      setLastCorrect(correct);
      setPointsEarned(points);
      setPhase('revealing');
    },
    [currentQuestion, phase, timeRemaining, streak]
  );

  // ── Next question handler ────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    const nextNum = questionNumberRef.current + 1;

    if (nextNum > totalCount) {
      // Game over
      setPhase('gameover');
      try {
        await fetch('/api/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: scoreRef.current,
            questionsAnswered: totalCount,
            correctAnswers: correctCountRef.current,
            streakMax: maxStreakRef.current,
            mode,
            timeSpent: totalCount * QUESTION_TIME,
          }),
        });
      } catch { /* silent */ }
      return;
    }

    // Guard against double-tap
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setPhase('loading');
    setSelectedAnswer(null);
    setLastCorrect(null);

    const q = await fetchQuestion();
    isFetchingRef.current = false;

    if (q) {
      questionNumberRef.current = nextNum;
      setQuestionNumber(nextNum);
      setCurrentQuestion(q);
      setTimeRemaining(QUESTION_TIME);
      setPhase('question');
    } else {
      // Fetch failed — end game rather than show nothing
      setPhase('gameover');
    }
  }, [totalCount, mode, fetchQuestion]);

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
        {/* Header */}
        <div className="flex justify-between items-center mb-6 max-w-2xl mx-auto w-full">
          <div>
            <span className="font-special-elite text-xs text-gray-400 block">RUNS</span>
            <span className="font-black-ops text-3xl" style={{ color: '#FFD700' }}>
              {score.toLocaleString()}
            </span>
          </div>
          <div className="text-center">
            <span className="font-special-elite text-xs text-gray-400 block">INNING</span>
            <span className="font-black-ops text-2xl" style={{ color: '#F5E642' }}>
              {questionNumber} / {totalCount}
            </span>
          </div>
          {streak >= 3 && (
            <div className="text-center">
              <span className="font-special-elite text-xs text-gray-400 block">STREAK</span>
              <span className="font-black-ops text-xl" style={{ color: '#FF8C00' }}>
                🔥 {streak}
              </span>
            </div>
          )}
          {phase === 'question' && currentQuestion && (
            <Timer
              duration={QUESTION_TIME}
              timeRemaining={timeRemaining}
              onTimeUp={() => handleAnswer('')}
              isRunning={phase === 'question'}
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
            {phase === 'loading' && (
              <div className="text-center py-12 font-special-elite text-gray-500">
                Loading question...
              </div>
            )}

            {(phase === 'question' || phase === 'revealing') && currentQuestion && (
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

                {/* key={currentQuestion.id} forces remount on every new question,
                    clearing all internal component state (TypeIn text field, etc.) */}
                {currentQuestion.type === 'multiple_choice' && (
                  <MultipleChoice
                    key={currentQuestion.id}
                    question={currentQuestion.text}
                    options={currentQuestion.options || []}
                    onAnswer={handleAnswer}
                    disabled={phase === 'revealing'}
                    selectedAnswer={selectedAnswer as string}
                    correctAnswer={
                      phase === 'revealing'
                        ? (currentQuestion.correct_answer as string)
                        : undefined
                    }
                  />
                )}
                {currentQuestion.type === 'true_false' && (
                  <TrueFalse
                    key={currentQuestion.id}
                    question={currentQuestion.text}
                    onAnswer={handleAnswer}
                    disabled={phase === 'revealing'}
                    selectedAnswer={selectedAnswer as string}
                    correctAnswer={
                      phase === 'revealing'
                        ? (currentQuestion.correct_answer as string)
                        : undefined
                    }
                  />
                )}
                {currentQuestion.type === 'type_in' && (
                  <TypeIn
                    key={currentQuestion.id}
                    question={currentQuestion.text}
                    onAnswer={handleAnswer}
                    disabled={phase === 'revealing'}
                    correctAnswer={
                      phase === 'revealing'
                        ? (currentQuestion.correct_answer as string)
                        : undefined
                    }
                    userAnswer={selectedAnswer as string}
                  />
                )}
                {currentQuestion.type === 'list_entry' && (
                  <ListEntry
                    key={currentQuestion.id}
                    question={currentQuestion.text}
                    onAnswer={(a) => handleAnswer(a)}
                    disabled={phase === 'revealing'}
                    correctAnswers={
                      phase === 'revealing'
                        ? (currentQuestion.correct_answer as string[])
                        : undefined
                    }
                    userAnswers={selectedAnswer as string[]}
                  />
                )}

                {phase === 'revealing' && (
                  <div className="mt-6 fade-in">
                    <div
                      className="p-4 mb-4"
                      style={{
                        background: lastCorrect
                          ? 'rgba(76,175,80,0.15)'
                          : 'rgba(255,68,68,0.15)',
                        border: `1px solid ${lastCorrect ? '#4CAF50' : '#FF4444'}40`,
                      }}
                    >
                      <p
                        className="font-black-ops text-lg mb-1"
                        style={{ color: lastCorrect ? '#4CAF50' : '#FF4444' }}
                      >
                        {lastCorrect
                          ? `✓ CORRECT! +${pointsEarned} RUNS`
                          : '✗ WRONG'}
                      </p>
                      <p className="font-special-elite text-sm text-gray-300">
                        {currentQuestion.explanation}
                      </p>
                    </div>
                    <button onClick={handleNext} className="ticket-stub w-full text-center">
                      {questionNumber >= totalCount
                        ? 'FINAL SCORECARD →'
                        : 'NEXT PITCH →'}
                    </button>
                  </div>
                )}
              </>
            )}

            {phase === 'gameover' && !showEmail && (
              <div className="text-center py-6 fade-in">
                <h2 className="font-black-ops text-4xl mb-2" style={{ color: '#FFD700' }}>
                  FINAL SCORE
                </h2>
                <p className="font-black-ops text-6xl mb-4" style={{ color: '#F5E642' }}>
                  {score.toLocaleString()}
                </p>
                <p className="font-special-elite text-lg text-gray-300 mb-2">
                  {correctCount} / {totalCount} correct
                </p>
                {maxStreak >= 3 && (
                  <p className="font-special-elite text-sm text-orange-400 mb-4">
                    Best streak: {maxStreak} 🔥
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

            {phase === 'gameover' && showEmail && (
              <EmailCapture
                score={score}
                correctAnswers={correctCount}
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
