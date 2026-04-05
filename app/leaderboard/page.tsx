import Leaderboard from '@/components/Leaderboard';

export const metadata = { title: "Leaderboard — Peck's Per Nine" };

export default function LeaderboardPage() {
  return (
    <main
      className="min-h-screen p-8"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1a0f 100%)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-black-ops text-5xl mb-2" style={{ color: '#F5E642' }}>
            SCOREBOARD
          </h1>
          <p className="font-special-elite text-gray-400">Updated every 60 seconds</p>
        </div>
        <Leaderboard />
      </div>
    </main>
  );
}
