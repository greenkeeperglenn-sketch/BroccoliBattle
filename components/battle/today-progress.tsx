"use client";

import { FIVE_A_DAY } from "@/lib/domain/scoring";

const SLOT_CHARS = ["🥕", "🍓", "🥦", "🍇", "⭐"];

/**
 * The daily five as five character slots that fill as you eat. Fractions
 * show as a half-lit slot; beyond five the count shows off.
 */
export function TodayProgress({
  total,
  onOpenLog,
}: {
  total: number;
  onOpenLog: () => void;
}) {
  const done = total >= FIVE_A_DAY;
  return (
    <section
      aria-label={`Today: ${total} of five portions`}
      className="card-sticker overflow-hidden bg-paper"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="font-display text-sm tracking-wide text-ink-soft">
          TODAY
        </h2>
        <button
          onClick={onOpenLog}
          className="font-display text-xs text-blueberry underline underline-offset-2"
        >
          Today&apos;s log
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1">
        <p className="font-display text-5xl leading-none">
          {formatUnits(total)}
          <span className="text-2xl text-ink-soft"> / 5</span>
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {SLOT_CHARS.map((char, i) => {
            const fill = Math.max(0, Math.min(1, total - i));
            return (
              <span
                key={i}
                className={`flex size-11 items-center justify-center rounded-full border-[2.5px] border-ink text-xl transition-all ${
                  fill >= 1
                    ? "animate-pop bg-broccoli-light"
                    : fill > 0
                      ? "bg-custard-light"
                      : "bg-cream opacity-50 grayscale"
                }`}
              >
                {fill > 0 ? (
                  <span className={fill < 1 ? "opacity-50" : ""}>{char}</span>
                ) : (
                  <span className="text-xs text-ink-soft">?</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {done ? (
        <p className="border-t-[3px] border-ink bg-broccoli px-4 py-1.5 text-center font-display text-sm text-white">
          {total > FIVE_A_DAY
            ? `${formatUnits(total)} / 5 — showing off now.`
            : "FIVE ACHIEVED. The council approves."}
        </p>
      ) : null}
    </section>
  );
}

export function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
