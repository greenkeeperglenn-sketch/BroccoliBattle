"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { FoodArt } from "@/components/foods/food-art";
import { formatLocalDate } from "@/lib/domain/dates";
import { formatUnits } from "@/components/battle/today-progress";
import type { CollectionCard } from "@/lib/domain/views";

/**
 * The family sticker book: every food as a collectible character card.
 * Undiscovered foods are silhouettes until someone eats one.
 */
export function CollectionGrid({ cards }: { cards: CollectionCard[] }) {
  const [filter, setFilter] = useState<"all" | "fruit" | "veg">("all");
  const [selected, setSelected] = useState<CollectionCard | null>(null);

  const visible = useMemo(
    () => cards.filter((c) => filter === "all" || c.category === filter),
    [cards, filter],
  );
  const discovered = cards.filter((c) => c.discovered).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="font-display text-2xl tracking-wide">🌈 THE COLLECTION</h1>
        <p className="text-xs font-bold text-ink-soft">
          {discovered} of {cards.length} fighters discovered by the family
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Filter">
        {(
          [
            { key: "all", label: "ALL" },
            { key: "fruit", label: "🍓 FRUIT" },
            { key: "veg", label: "🥦 VEG" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`pressable rounded-2xl border-[3px] border-ink py-2 font-display text-sm ${
              filter === tab.key ? "bg-custard shadow-sticker-sm" : "bg-paper opacity-60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {visible.map((card) => (
          <button
            key={card.id}
            onClick={() => card.discovered && setSelected(card)}
            disabled={!card.discovered}
            className={`card-sticker relative flex min-h-28 flex-col items-center justify-center gap-1 px-1 py-3 ${
              card.discovered ? "pressable" : "opacity-60"
            }`}
          >
            {card.champion ? (
              <span
                className="absolute right-1.5 top-1.5 text-[10px]"
                title={`Family champion: ${card.champion}`}
              >
                👑
              </span>
            ) : null}
            <span className={card.discovered ? "" : "opacity-40 grayscale"}>
              <FoodArt
                name={card.name}
                emoji={card.emoji}
                iconUrl={card.iconUrl}
                className="size-12"
                emojiClassName="text-4xl"
              />
            </span>
            <span className="font-display text-[11px] leading-tight">
              {card.discovered ? card.name.toUpperCase() : "???"}
            </span>
          </button>
        ))}
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name}
      >
        {selected ? (
          <div className="flex flex-col items-center gap-3 pb-5 text-center">
            <div className="animate-float">
              <FoodArt
                name={selected.name}
                emoji={selected.emoji}
                iconUrl={selected.iconUrl}
                className="size-28"
                emojiClassName="text-8xl"
              />
            </div>
            {selected.personality ? (
              <p className="text-sm font-bold italic text-ink-soft">
                “{selected.personality}”
              </p>
            ) : null}
            <dl className="card-sticker w-full px-4 py-3 text-left text-sm font-bold">
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-soft">Discovered</dt>
                <dd>
                  {selected.discoveredOn
                    ? formatLocalDate(selected.discoveredOn, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-soft">Eaten by family</dt>
                <dd>{selected.familyTimes} times</dd>
              </div>
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-soft">Your portions</dt>
                <dd>{formatUnits(selected.yourPortions)}</dd>
              </div>
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-soft">Family champion</dt>
                <dd>{selected.champion ? `👑 ${selected.champion}` : "—"}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
