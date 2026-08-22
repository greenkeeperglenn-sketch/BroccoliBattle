"use client";

import { useMemo, useState } from "react";
import { FoodArt } from "./food-art";
import type { LoggerFood } from "@/lib/domain/views";

/**
 * LOG YOUR GLORY: fruit/veg toggle, character grid ordered by recency and
 * frequency, search for the long tail, and the add-a-food escape hatch.
 */
export function FoodLogger({
  foods,
  onPick,
  onAddFood,
}: {
  foods: LoggerFood[];
  onPick: (food: LoggerFood) => void;
  onAddFood: () => void;
}) {
  const [category, setCategory] = useState<"fruit" | "veg">("veg");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return foods.filter((f) => f.name.toLowerCase().includes(q));
    }
    return foods.filter((f) => f.category === category);
  }, [foods, category, query]);

  return (
    <section aria-label="Log your glory">
      <h2 className="font-display pb-2 text-center text-xl tracking-wide">
        LOG YOUR GLORY
      </h2>

      <div className="grid grid-cols-2 gap-2 pb-3" role="tablist" aria-label="Category">
        {(
          [
            { key: "fruit", label: "FRUIT", emoji: "🍓", bg: "bg-tomato-light" },
            { key: "veg", label: "VEG", emoji: "🥦", bg: "bg-broccoli-light" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={category === tab.key && !query}
            onClick={() => {
              setCategory(tab.key);
              setQuery("");
            }}
            className={`pressable rounded-2xl border-[3px] border-ink py-3 font-display text-xl ${
              category === tab.key && !query
                ? `${tab.bg} shadow-sticker-sm`
                : "bg-paper opacity-60"
            }`}
          >
            <span aria-hidden="true">{tab.emoji}</span> {tab.label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the whole menu…"
        aria-label="Search foods"
        className="mb-3 w-full rounded-2xl border-[3px] border-ink bg-paper px-4 py-2.5 text-sm font-bold outline-none placeholder:text-ink-soft/50"
      />

      <div className="grid grid-cols-3 gap-2">
        {visible.map((food) => (
          <button
            key={food.id}
            onClick={() => onPick(food)}
            className="pressable card-sticker relative flex min-h-24 flex-col items-center justify-center gap-1 px-1 py-2.5"
          >
            {food.recent ? (
              <span
                className="absolute right-1.5 top-1.5 text-[10px]"
                title="Recent favourite"
                aria-label="Recent favourite"
              >
                ⭐
              </span>
            ) : null}
            <FoodArt
              name={food.name}
              emoji={food.emoji}
              iconUrl={food.iconUrl}
              className="size-12"
              emojiClassName="text-4xl"
            />
            <span className="font-display text-[11px] leading-tight">
              {food.name.toUpperCase()}
            </span>
          </button>
        ))}

        <button
          onClick={onAddFood}
          className="pressable flex min-h-24 flex-col items-center justify-center gap-1 rounded-[1.25rem] border-[3px] border-dashed border-ink-soft bg-cream px-1 py-2.5 text-ink-soft"
        >
          <span className="text-3xl" aria-hidden="true">＋</span>
          <span className="font-display text-[11px] leading-tight">
            CAN&apos;T FIND IT?
          </span>
        </button>
      </div>

      {visible.length === 0 && query ? (
        <p className="pt-3 text-center text-sm font-bold text-ink-soft">
          Nothing called “{query}” in the catalogue. Add it above!
        </p>
      ) : null}
    </section>
  );
}
