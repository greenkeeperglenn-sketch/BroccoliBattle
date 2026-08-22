"use client";

import { useMemo, useRef, useState } from "react";
import { Confetti } from "@/components/ui/confetti";

export type WheelSegment = {
  id: string;
  title: string;
  emoji: string;
  weight: number;
};

const SEGMENT_COLORS = ["#ffc93c", "#d3f2da", "#ffd9d2", "#e4dcf9", "#ffe6c7", "#fff2cd"];

type Phase = "ready" | "spinning" | "revealed" | "error";

/**
 * The prize wheel. The REAL prize is decided and persisted by the server
 * the moment SPIN is pressed; the wheel animation then physically lands on
 * that authoritative result. Refreshing mid-spin costs nothing but drama.
 */
export function PrizeWheel({
  battleId,
  segments,
}: {
  battleId: string;
  segments: WheelSegment[];
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize] = useState<{ title: string; emoji: string; description: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);

  // Precompute segment angular spans (degrees), starting at 12 o'clock.
  const spans = useMemo(() => {
    const cumulative: number[] = [0];
    for (const s of segments) {
      cumulative.push(cumulative[cumulative.length - 1] + s.weight);
    }
    return segments.map((s, i) => {
      const start = (cumulative[i] / totalWeight) * 360;
      const end = (cumulative[i + 1] / totalWeight) * 360;
      return { ...s, start, end, mid: (start + end) / 2 };
    });
  }, [segments, totalWeight]);

  const spin = async () => {
    if (phase === "spinning") return;
    setPhase("spinning");
    setError(null);
    try {
      const res = await fetch("/api/prizes/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPhase("error");
        setError(
          data?.error?.code === "already_spun"
            ? "This spin has already been used. Check your Prize Wallet!"
            : data?.error?.message ?? "The wheel jammed. Try again.",
        );
        return;
      }

      const winning = spans.find(
        (s) => s.id === data.prize.prizeDefinitionId,
      );
      const landing = winning ? winning.mid : 0;
      // Spin 5 full turns then land with the winning segment under the
      // pointer (pointer sits at the top = 0°).
      const target = 5 * 360 + (360 - landing);
      setRotation(target);
      setPrize({
        title: data.prize.title,
        emoji: data.prize.emoji,
        description: data.prize.description,
      });
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      // No router.refresh() here: the server page would swap the celebration
      // for the "already spun" view. The reveal card handles onward links.
      revealTimer.current = setTimeout(() => setPhase("revealed"), 4300);
    } catch {
      setPhase("error");
      setError("Battle HQ is unreachable. Your spin is safe — try again when you're online.");
    }
  };

  const R = 130;
  const toXY = (angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [150 + R * Math.cos(rad), 150 + R * Math.sin(rad)];
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        {/* pointer */}
        <div
          aria-hidden="true"
          className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-3xl drop-shadow"
        >
          🔻
        </div>
        <svg
          viewBox="0 0 300 300"
          className="size-72 max-w-full"
          role="img"
          aria-label="Prize wheel"
        >
          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "150px 150px",
              transition:
                phase === "spinning" || phase === "revealed"
                  ? "transform 4.2s cubic-bezier(0.12, 0.8, 0.16, 1)"
                  : undefined,
            }}
          >
            {spans.map((s, i) => {
              const [x1, y1] = toXY(s.start);
              const [x2, y2] = toXY(s.end);
              const large = s.end - s.start > 180 ? 1 : 0;
              const [lx, ly] = toXY(s.mid);
              const labelX = 150 + (lx - 150) * 0.62;
              const labelY = 150 + (ly - 150) * 0.62;
              return (
                <g key={s.id}>
                  <path
                    d={`M150 150 L${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
                    fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                    stroke="#2b2117"
                    strokeWidth="4"
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="26"
                  >
                    {s.emoji}
                  </text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r={R} fill="none" stroke="#2b2117" strokeWidth="6" />
          </g>
          <circle cx="150" cy="150" r="26" fill="#2b2117" />
          <text x="150" y="151" textAnchor="middle" dominantBaseline="central" fontSize="22">
            🥦
          </text>
        </svg>
      </div>

      {phase === "ready" || phase === "error" ? (
        <>
          <button
            onClick={spin}
            className="pressable card-sticker w-full bg-tomato px-6 py-4 text-center font-display text-3xl text-white"
          >
            SPIN FOR GLORY
          </button>
          {error ? (
            <p role="alert" className="card-sticker bg-tomato-light px-4 py-2 text-center text-sm font-bold">
              {error}
            </p>
          ) : null}
        </>
      ) : null}

      {phase === "spinning" ? (
        <p className="font-display animate-pulse text-xl text-ink-soft">
          The wheel decides…
        </p>
      ) : null}

      {phase === "revealed" && prize ? (
        <div className="animate-pop w-full text-center">
          <Confetti count={48} />
          <div className="card-sticker bg-custard px-5 py-5">
            <p className="text-5xl" aria-hidden="true">{prize.emoji}</p>
            <p className="font-display pt-2 text-2xl">{prize.title.toUpperCase()}</p>
            {prize.description ? (
              <p className="pt-1 text-sm font-bold text-ink-soft">
                {prize.description}
              </p>
            ) : null}
            <p className="font-display pt-3 text-sm text-broccoli-dark">
              🎟️ A prize ticket has landed in your wallet.
            </p>
          </div>
          <a
            href="/prizes"
            className="pressable card-sticker mt-4 block bg-broccoli px-4 py-3 font-display text-xl text-white"
          >
            OPEN PRIZE WALLET
          </a>
        </div>
      ) : null}

      <ul className="w-full pb-4 text-xs font-bold text-ink-soft">
        {segments.map((s) => (
          <li key={s.id} className="flex justify-between border-b border-ink/10 py-1">
            <span>
              {s.emoji} {s.title}
            </span>
            <span aria-label={`weight ${s.weight}`}>
              {"•".repeat(Math.min(6, s.weight))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
