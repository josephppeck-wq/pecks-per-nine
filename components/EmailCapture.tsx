'use client';
import { useState } from 'react';

interface EmailCaptureProps {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  mode: string;
  onSent?: () => void;
  onSkip?: () => void;
}

export default function EmailCapture({
  score,
  correctAnswers,
  totalQuestions,
  mode,
  onSent,
  onSkip,
}: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/send-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          playerName: name || email.split('@')[0],
          score,
          correctAnswers,
          totalQuestions,
          mode,
        }),
      });
      if (res.ok) {
        setStatus('sent');
        onSent?.();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      className="w-full max-w-md mx-auto p-8"
      style={{ background: 'rgba(10,10,15,0.95)', border: '3px solid #F5E642' }}
    >
      <div className="text-center mb-6">
        <p className="font-special-elite text-xs text-gray-500 mb-1 tracking-widest">
          WESTERN UNION TELEGRAPH
        </p>
        <h2 className="font-black-ops text-2xl" style={{ color: '#F5E642' }}>
          SEND SCORECARD
        </h2>
        <p className="font-special-elite text-sm text-gray-400 mt-1">VIA TELEGRAPH TO YOUR INBOX</p>
      </div>

      {status === 'sent' ? (
        <div className="text-center py-4">
          <p className="font-black-ops text-xl" style={{ color: '#4CAF50' }}>
            MESSAGE TRANSMITTED
          </p>
          <p className="font-special-elite text-sm text-gray-400 mt-2">
            Check your telegraph machine
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="font-special-elite text-xs text-gray-500 tracking-widest block mb-1">
              TELEGRAPH ADDRESS (EMAIL)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full px-4 py-2 font-special-elite"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(245,230,66,0.5)',
                color: '#F5E642',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label className="font-special-elite text-xs text-gray-500 tracking-widest block mb-1">
              OPERATOR NAME (OPTIONAL)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 font-special-elite"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(245,230,66,0.3)',
                color: '#F5E642',
                outline: 'none',
              }}
            />
          </div>
          {status === 'error' && (
            <p className="font-special-elite text-xs text-red-400">
              Transmission failed. Try again.
            </p>
          )}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={status === 'sending'}
              className="ticket-stub flex-1 text-sm"
            >
              {status === 'sending' ? 'TRANSMITTING...' : 'TRANSMIT'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="font-special-elite text-xs text-gray-500 hover:text-gray-300 px-4"
            >
              SKIP
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
