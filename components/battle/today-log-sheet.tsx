"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { FoodArt } from "@/components/foods/food-art";
import { formatUnits } from "./today-progress";
import type { TodayEntry } from "@/lib/domain/views";
import type { PortionSize } from "@/lib/domain/scoring";

const SIZE_LABEL: Record<PortionSize, string> = {
  small: "Small",
  fist: "Fist",
  monster: "Monster",
};

/** Today's recent log: change a portion size or delete a mistake. */
export function TodayLogSheet({
  open,
  entries,
  onClose,
  onDelete,
  onResize,
}: {
  open: boolean;
  entries: TodayEntry[];
  onClose: () => void;
  onDelete: (entry: TodayEntry) => void;
  onResize: (entry: TodayEntry, size: PortionSize) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Today's log">
      <div className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto pb-4">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm font-bold text-ink-soft">
            Nothing eaten yet. The broccoli is concerned.
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.clientEventId} className="card-sticker px-3 py-2">
              <div className="flex items-center gap-3">
                <FoodArt
                  name={entry.foodName}
                  emoji={entry.emoji}
                  iconUrl={entry.iconUrl}
                  className="size-9"
                  emojiClassName="text-3xl"
                />
                <div className="flex-1">
                  <p className="font-display text-sm">{entry.foodName}</p>
                  <p className="text-xs font-bold text-ink-soft">
                    {SIZE_LABEL[entry.portionSize]} · {formatUnits(entry.portionUnits)}{" "}
                    {entry.portionUnits === 1 ? "portion" : "portions"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditing(editing === entry.id ? null : entry.id)
                  }
                  className="font-display text-xs text-blueberry underline underline-offset-2"
                >
                  {editing === entry.id ? "Done" : "Edit"}
                </button>
              </div>
              {editing === entry.id ? (
                <div className="flex items-center gap-2 pt-2">
                  {(Object.keys(SIZE_LABEL) as PortionSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => onResize(entry, size)}
                      aria-pressed={entry.portionSize === size}
                      className={`pressable flex-1 rounded-xl border-2 border-ink py-1.5 text-xs font-bold ${
                        entry.portionSize === size ? "bg-custard" : "bg-paper"
                      }`}
                    >
                      {SIZE_LABEL[size]}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      onDelete(entry);
                      setEditing(null);
                    }}
                    className="pressable rounded-xl border-2 border-ink bg-tomato-light px-3 py-1.5 text-xs font-bold"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
}
