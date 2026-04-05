'use client';
import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  color: string;
  trail: { x: number; y: number }[];
  exploded: boolean;
}

export default function BirthdayFireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) return;
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = [
      '#FFD700',
      '#FFD700',
      '#FFD700',
      '#000000',
      '#FF4444',
      '#FFFFFF',
      '#4444FF',
      '#FF8C00',
    ];
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    let animId: number;
    let lastTime = 0;
    let rocketTimer = 0;
    const ROCKET_INTERVAL = 900 + Math.random() * 400;

    function explode(x: number, y: number) {
      const count = 40 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 2 + Math.random() * 3,
        });
      }
    }

    function launchRocket() {
      const x = canvas.width * 0.2 + Math.random() * canvas.width * 0.6;
      rockets.push({
        x,
        y: canvas.height,
        vy: -(canvas.height * 0.012 + Math.random() * canvas.height * 0.008),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        trail: [],
        exploded: false,
      });
    }

    function draw(timestamp: number) {
      const dt = Math.min((timestamp - lastTime) / 16.67, 3);
      lastTime = timestamp;
      rocketTimer += dt * 16.67;

      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (rocketTimer >= ROCKET_INTERVAL) {
        launchRocket();
        rocketTimer = 0;
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        if (r.exploded) {
          rockets.splice(i, 1);
          continue;
        }
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();
        r.y += r.vy * dt;
        r.vy += 0.08 * dt;

        r.trail.forEach((pt, idx) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,220,100,${(idx / r.trail.length) * 0.6})`;
          ctx.fill();
        });
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        if (r.vy >= 0) {
          explode(r.x, r.y);
          r.exploded = true;
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.08 * dt;
        p.life -= (0.012 / p.maxLife) * dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
