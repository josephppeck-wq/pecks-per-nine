'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { isBirthday } from '@/lib/birthday';
import BirthdayFireworks from '@/components/BirthdayFireworks';

export default function Home() {
  const [birthday, setBirthday] = useState(false);

  useEffect(() => {
    setBirthday(isBirthday());
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      {/* Background photo z-index 0 */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <Image
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Forbes_Field_interior.jpg/1280px-Forbes_Field_interior.jpg"
          alt="Forbes Field"
          fill
          style={{ objectFit: 'cover', filter: 'sepia(0.4) brightness(0.9)' }}
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Fireworks z-index 1 */}
      {birthday && <BirthdayFireworks />}

      {/* Scoreboard z-index 2 */}
      <div
        className={`relative text-center px-8 py-12 ${birthday ? 'birthday-border' : 'border-4 border-[#F5E642]'}`}
        style={{
          zIndex: 2,
          background: 'rgba(10,10,15,0.85)',
          minWidth: 320,
          maxWidth: 600,
          boxShadow: '0 0 40px rgba(0,0,0,0.8)',
        }}
      >
        {birthday ? (
          <>
            <p className="font-black-ops text-2xl mb-2" style={{ color: '#FFD700' }}>
              HAPPY BIRTHDAY
            </p>
            <h1
              className="font-black-ops text-5xl mb-2"
              style={{ color: '#FFD700', letterSpacing: '0.05em' }}
            >
              JOHN PECK
            </h1>
          </>
        ) : (
          <h1
            className="font-black-ops text-5xl mb-4"
            style={{ color: '#F5E642', letterSpacing: '0.05em' }}
          >
            PECK&apos;S
            <br />
            PER NINE
          </h1>
        )}

        <p className="font-special-elite text-lg text-gray-300 mb-8">
          Baseball Trivia from the Golden Age
        </p>

        {/* Ticket stub buttons z-index 3 */}
        <div
          className="flex gap-4 justify-center flex-wrap"
          style={{ zIndex: 3, position: 'relative' }}
        >
          <Link href="/play" className="ticket-stub">
            PLAY BALL
          </Link>
          <Link href="/daily" className="ticket-stub ticket-stub-secondary">
            TODAY&apos;S QUESTION
          </Link>
        </div>

        <div className="mt-8 flex gap-6 justify-center">
          <Link
            href="/leaderboard"
            className="font-special-elite text-[#F5E642] hover:text-white text-sm underline-offset-2 hover:underline"
          >
            LEADERBOARD
          </Link>
        </div>
      </div>
    </main>
  );
}
