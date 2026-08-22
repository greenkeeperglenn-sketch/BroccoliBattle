"use client";

import { formatUnits } from "./today-progress";

const GARDEN_PLANTS = [
  "🌱", "🌷", "🥕", "🌻", "🍓", "🥦", "🌽", "🍅",
  "🌸", "🍇", "🌳", "🐝", "🍉", "🦋",
];

/**
 * The Battle Garden: the family's weekly 140 as a patch that fills with
 * increasingly ridiculous plants as everyone logs food.
 */
export function FamilyGarden({
  total,
  target,
}: {
  total: number;
  target: number;
}) {
  const ratio = target > 0 ? Math.min(1, total / target) : 0;
  const grown = Math.floor(ratio * GARDEN_PLANTS.length);
  const destroyed = total >= target;

  return (
    <section
      aria-label={`Family total ${total} of ${target} portions this week`}
      className="card-sticker overflow-hidden"
    >
      <div className="flex items-baseline justify-between px-4 pt-3">
        <h2 className="font-display text-sm tracking-wide text-ink-soft">
          THE BATTLE GARDEN
        </h2>
        <p className="font-display text-lg">
          {formatUnits(total)}
          <span className="text-sm text-ink-soft"> / {target}</span>
        </p>
      </div>
      <div className="px-4 pb-3 pt-1">
        <div
          className="flex h-12 items-end gap-0.5 overflow-hidden rounded-xl border-[2.5px] border-ink bg-gradient-to-b from-sky-100 to-broccoli-light px-2 pb-1"
          aria-hidden="true"
        >
          {GARDEN_PLANTS.map((plant, i) => (
            <span
              key={i}
              className={`flex-1 text-center transition-all duration-500 ${
                i < grown
                  ? "animate-pop text-xl"
                  : "translate-y-3 text-xs opacity-30 grayscale"
              }`}
            >
              {i < grown ? plant : "·"}
            </span>
          ))}
        </div>
        <p className="pt-2 text-center text-[11px] font-bold text-ink-soft">
          {destroyed
            ? "FAMILY TARGET DESTROYED. Absolute scenes."
            : `The family patch grows with every portion. ${formatUnits(Math.max(0, target - total))} to go.`}
        </p>
      </div>
    </section>
  );
}
