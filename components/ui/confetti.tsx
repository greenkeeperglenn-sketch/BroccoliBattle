"use client";

import { useEffect, useState } from "react";

const COLORS = ["#2f9e44", "#e8452c", "#6c4bc8", "#f78c1e", "#ffc93c"];

type Piece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
};

/** A brief full-screen confetti burst. Mount it to fire once. */
export function Confetti({ count = 36 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    // Pieces are created client-side only (random layout would break SSR
    // hydration), fired from a task callback rather than the effect body.
    const start = setTimeout(() => {
      setPieces(
        Array.from({ length: count }, (_, id) => ({
          id,
          left: Math.random() * 100,
          delay: Math.random() * 0.4,
          duration: 1.6 + Math.random() * 1.4,
          color: COLORS[id % COLORS.length],
        })),
      );
    }, 0);
    const timer = setTimeout(() => setPieces([]), 3500);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [count]);

  return (
    <div aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
