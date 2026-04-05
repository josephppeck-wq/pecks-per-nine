'use client';
import { useState, useEffect, useCallback } from 'react';

interface LeaderboardEntry {
  display_name?: string;
  email?: string;
  total_score?: number;
  score?: number;
  games_played?: number;
  best_game?: number;
  correct_answers?: number;
  mode?: string;
  created_at?: string;
}

export default function Leaderboard() {
  const [tab, setTab] = useState<'alltime' | 'bestgame' | 'today'>('alltime');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?type=${tab}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, [fetchData]);

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  const getScore = (entry: LeaderboardEntry) => entry.total_score ?? entry.score ?? 0;
  const getName = (entry: LeaderboardEntry) => {
    const raw = entry.display_name || entry.email || 'Anonymous';
    return raw.includes('@') ? raw.split('@')[0] : raw;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-0 mb-6 border-b-2 border-[#F5E642]/30">
        {(['alltime', 'bestgame', 'today'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-black-ops px-6 py-3 text-sm tracking-wide transition-all"
            style={{
              background: tab === t ? 'rgba(245,230,66,0.15)' : 'transparent',
              color: tab === t ? '#F5E642' : '#666',
              borderBottom: tab === t ? '2px solid #F5E642' : '2px solid transparent',
            }}
          >
            {t === 'alltime' ? 'ALL TIME' : t === 'bestgame' ? 'BEST GAME' : 'TODAY'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 font-special-elite text-gray-500">Loading scores...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 font-special-elite text-gray-500">
          No scores yet. Be the first!
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3"
              style={{
                background:
                  i < 3
                    ? `rgba(${i === 0 ? '255,215,0' : i === 1 ? '192,192,192' : '205,127,50'},0.08)`
                    : 'rgba(255,255,255,0.03)',
                border:
                  i < 3
                    ? `1px solid ${medalColors[i]}30`
                    : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span className="text-xl w-8 text-center">
                {i < 3 ? (
                  ['🥇', '🥈', '🥉'][i]
                ) : (
                  <span className="font-black-ops text-sm text-gray-600">{i + 1}</span>
                )}
              </span>
              <span className="font-special-elite flex-1 text-white">{getName(entry)}</span>
              <span
                className="font-black-ops text-lg"
                style={{ color: i < 3 ? medalColors[i] : '#F5E642' }}
              >
                {getScore(entry).toLocaleString()}
              </span>
              <span className="font-special-elite text-xs text-gray-500">RUNS</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
