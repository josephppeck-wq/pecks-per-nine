'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Mode = 'quick_nine' | 'custom' | 'daily' | 'sabermetrics';
type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export default function PlayPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [questionCount, setQuestionCount] = useState(9);
  const [category, setCategory] = useState('all');

  const MODES: { id: Mode; label: string; desc: string; icon: string }[] = [
    { id: 'quick_nine', label: 'QUICK NINE', desc: '9 random questions, any era', icon: '⚾' },
    { id: 'custom', label: 'CUSTOM GAME', desc: 'Choose your difficulty & era', icon: '📋' },
    {
      id: 'daily',
      label: 'DAILY QUESTION',
      desc: "Today's single question challenge",
      icon: '📅',
    },
    {
      id: 'sabermetrics',
      label: 'SABERMETRICS',
      desc: 'Advanced stats & analytics',
      icon: '📊',
    },
  ];

  const DIFFICULTIES: { id: Difficulty; label: string }[] = [
    { id: 'easy', label: 'BUSH LEAGUE' },
    { id: 'medium', label: 'TRIPLE-A' },
    { id: 'hard', label: 'THE SHOW' },
    { id: 'mixed', label: 'MIXED BAG' },
  ];

  const CATEGORIES = ['all', 'players', 'teams', 'records', 'stadiums', 'history', 'stats'];
  const COUNTS = [3, 5, 9, 18, 27];

  const handleStart = () => {
    if (!selectedMode) return;
    if (selectedMode === 'daily') {
      router.push('/daily');
      return;
    }
    const params = new URLSearchParams({
      mode: selectedMode,
      difficulty,
      count: questionCount.toString(),
      category,
    });
    router.push(`/play/${selectedMode}?${params.toString()}`);
  };

  return (
    <main
      className="min-h-screen p-6"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0a150a 100%)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <Link
            href="/"
            className="font-special-elite text-sm text-gray-500 hover:text-gray-300 mb-4 block"
          >
            ← BACK TO GATE
          </Link>
          <h1 className="font-black-ops text-4xl mb-2" style={{ color: '#F5E642' }}>
            CHOOSE YOUR GAME
          </h1>
          <p className="font-special-elite text-gray-500">Select from the concourse board</p>
        </div>

        {/* Mode selection — chalkboard style */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className="p-4 text-left transition-all"
              style={{
                background:
                  selectedMode === mode.id ? 'rgba(245,230,66,0.15)' : 'rgba(255,255,255,0.03)',
                border:
                  selectedMode === mode.id
                    ? '2px solid #F5E642'
                    : '2px solid rgba(255,255,255,0.1)',
                boxShadow:
                  selectedMode === mode.id ? '0 0 20px rgba(245,230,66,0.2)' : 'none',
              }}
            >
              <div className="text-2xl mb-2">{mode.icon}</div>
              <div className="font-black-ops text-sm mb-1" style={{ color: '#F5E642' }}>
                {mode.label}
              </div>
              <div className="font-special-elite text-xs text-gray-500">{mode.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom options — vintage number tiles */}
        {selectedMode === 'custom' && (
          <div
            className="p-6 mb-6 fade-in"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(245,230,66,0.2)',
            }}
          >
            <h3 className="font-black-ops text-sm mb-4" style={{ color: '#F5E642' }}>
              CUSTOM OPTIONS
            </h3>

            <div className="mb-4">
              <p className="font-special-elite text-xs text-gray-500 mb-2 tracking-widest">
                DIFFICULTY
              </p>
              <div className="flex gap-2 flex-wrap">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className="font-black-ops text-xs px-3 py-2 transition-all"
                    style={{
                      background:
                        difficulty === d.id ? '#8B1A1A' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${difficulty === d.id ? '#F5E642' : 'rgba(255,255,255,0.1)'}`,
                      color: difficulty === d.id ? '#F5E642' : '#666',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="font-special-elite text-xs text-gray-500 mb-2 tracking-widest">
                INNINGS (QUESTIONS)
              </p>
              <div className="flex gap-2 flex-wrap">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setQuestionCount(c)}
                    className="font-black-ops text-lg w-12 h-12 transition-all"
                    style={{
                      background:
                        questionCount === c ? '#8B1A1A' : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${questionCount === c ? '#F5E642' : 'rgba(255,255,255,0.1)'}`,
                      color: questionCount === c ? '#F5E642' : '#666',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-special-elite text-xs text-gray-500 mb-2 tracking-widest">
                CATEGORY
              </p>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="font-black-ops text-xs px-3 py-2 transition-all capitalize"
                    style={{
                      background: category === c ? '#8B1A1A' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${category === c ? '#F5E642' : 'rgba(255,255,255,0.1)'}`,
                      color: category === c ? '#F5E642' : '#666',
                    }}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleStart}
            disabled={!selectedMode}
            className="ticket-stub text-xl px-16 py-4 disabled:opacity-30"
          >
            PLAY BALL
          </button>
        </div>
      </div>
    </main>
  );
}
