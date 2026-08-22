"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { FoodArt } from "./food-art";
import type { LoggerFood } from "@/lib/domain/views";
import { PORTION_UNITS, type PortionSize } from "@/lib/domain/scoring";

const SIZE_META: {
  size: PortionSize;
  label: string;
  hint: string;
  scale: string;
}[] = [
  { size: "small", label: "SMALL", hint: "a little one", scale: "scale-[0.55]" },
  { size: "fist", label: "FIST", hint: "a normal fist-sized portion", scale: "scale-90" },
  { size: "monster", label: "MONSTER", hint: "an absurd amount", scale: "scale-[1.35]" },
];

/**
 * Portion picker: the character physically grows with the chosen size, and
 * LOG IT commits — explicit enough to avoid accidental entries, fast enough
 * to take a second.
 */
export function PortionSheet({
  food,
  onClose,
  onLog,
}: {
  food: LoggerFood | null;
  onClose: () => void;
  onLog: (food: LoggerFood, size: PortionSize) => void;
}) {
  const [size, setSize] = useState<PortionSize>("fist");
  const meta = SIZE_META.find((m) => m.size === size)!;

  return (
    <Sheet
      open={food !== null}
      onClose={() => {
        setSize("fist");
        onClose();
      }}
      title={food?.name}
    >
      {food ? (
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex h-36 items-center justify-center overflow-visible">
            <div
              className={`flex size-32 items-center justify-center transition-transform duration-200 ease-out ${meta.scale} ${size === "monster" ? "animate-wiggle" : ""}`}
            >
              <FoodArt
                name={food.name}
                emoji={food.emoji}
                iconUrl={food.iconUrl}
                className="size-full"
                emojiClassName="text-8xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Portion size">
            {SIZE_META.map((m) => (
              <button
                key={m.size}
                role="radio"
                aria-checked={size === m.size}
                onClick={() => setSize(m.size)}
                className={`pressable rounded-2xl border-[3px] border-ink px-2 py-2.5 text-center ${
                  size === m.size
                    ? "bg-custard shadow-sticker-sm"
                    : "bg-paper opacity-70"
                }`}
              >
                <span className="font-display block text-sm">{m.label}</span>
                <span className="block text-[11px] font-bold text-ink-soft">
                  {PORTION_UNITS[m.size]} {PORTION_UNITS[m.size] === 1 ? "portion" : "portions"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-center text-xs font-bold text-ink-soft" aria-live="polite">
            {meta.hint}
          </p>

          <button
            onClick={() => {
              onLog(food, size);
              setSize("fist");
            }}
            className="pressable card-sticker bg-broccoli py-3.5 text-center font-display text-2xl text-white"
          >
            LOG IT
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
