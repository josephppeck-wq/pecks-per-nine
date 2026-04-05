'use client';
import { useEffect, useRef } from 'react';

interface TimerProps {
  duration: number;
  timeRemaining: number;
  onTimeUp: () => void;
  isRunning: boolean;
}

export default function Timer({ duration, timeRemaining, onTimeUp, isRunning }: TimerProps) {
  const hasCalledTimeUp = useRef(false);

  useEffect(() => {
    if (timeRemaining <= 0 && !hasCalledTimeUp.current) {
      hasCalledTimeUp.current = true;
      onTimeUp();
    }
    if (timeRemaining > 0) hasCalledTimeUp.current = false;
  }, [timeRemaining, onTimeUp]);

  const pct = (timeRemaining / duration) * 100;
  const isWarning = timeRemaining <= 10;
  const color = isWarning ? '#FF4444' : timeRemaining <= 20 ? '#FF8C00' : '#4CAF50';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="font-black-ops text-4xl tabular-nums"
        style={{
          color: isWarning ? '#FF4444' : '#F5E642',
          animation: isWarning && isRunning ? 'pulse 0.5s infinite' : 'none',
        }}
      >
        {timeRemaining}
      </div>
      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
