"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fire a hurray moment from anywhere: confetti cannons + a message chip.
 * Rendered by <CelebrationLayer/> mounted once in the root layout.
 */
export function celebrate(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("archit:celebrate", { detail: { message } }),
  );
}

const COLORS = [
  "#f0483e", // coral
  "#e2ef6a", // lime
  "#ccdb2a", // lime deep
  "#e857c2", // magenta
  "#b18cf0", // lavender
  "#3d1830", // plum
  "#fffdf7",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 0 | 1 | 2; // rect, dot, ribbon
  life: number;
  ttl: number;
}

function cannon(
  parts: Particle[],
  x: number,
  y: number,
  baseAngle: number,
  spread: number,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const a = baseAngle + (Math.random() - 0.5) * spread;
    const speed = 12 + Math.random() * 9;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 10,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      shape: ((Math.random() * 3) | 0) as 0 | 1 | 2,
      life: 0,
      ttl: 110 + Math.random() * 50,
    });
  }
}

export default function CelebrationLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const partsRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const [message, setMessage] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => {
      const canvas = canvasRef.current;
      const parts = partsRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.life++;
        p.vy += 0.26; // gravity
        p.vx *= 0.991;
        p.vy *= 0.991;
        p.x += p.vx + (p.shape === 2 ? Math.sin(p.life * 0.3) * 1.4 : 0);
        p.y += p.vy;
        p.rot += p.vr;
        const fade = Math.min(1, (p.ttl - p.life) / (p.ttl * 0.25));
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.shape === 0) {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // ribbon: tall thin strip that appears to flutter
          ctx.scale(1, 0.6 + 0.4 * Math.sin(p.life * 0.25));
          ctx.fillRect(-p.w / 4, -p.h, p.w / 2, p.h * 2);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      partsRef.current = parts.filter(
        (p) => p.life < p.ttl && p.y < canvas.height + 40,
      );
      if (partsRef.current.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = 0;
      }
    };

    const onCelebrate = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      setMessage(msg || "Hurray!");
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setMessage(null), 2600);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const W = canvas.width;
      const H = canvas.height;
      const parts = partsRef.current;
      cannon(parts, W * 0.12, H + 12, -Math.PI * 0.42, 0.55, 55); // left cannon
      cannon(parts, W * 0.88, H + 12, -Math.PI * 0.58, 0.55, 55); // right cannon
      cannon(parts, W * 0.5, H + 12, -Math.PI * 0.5, 0.9, 50); // center fountain
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("archit:celebrate", onCelebrate);
    return () => {
      window.removeEventListener("archit:celebrate", onCelebrate);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <canvas ref={canvasRef} className="h-full w-full" />
      {message && (
        <div className="absolute inset-x-0 top-[26%] flex justify-center">
          <div className="hurray-chip flex items-center gap-2.5 rounded-full border border-white/60 bg-white/80 px-6 py-3 shadow-[0_18px_50px_-12px_rgba(61,24,48,.35)] backdrop-blur-md">
            <span className="hurray-emoji text-[22px]">🎉</span>
            <span className="text-[15px] font-extrabold tracking-tight text-plum">
              {message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
