"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TodayProgress, formatUnits } from "./today-progress";
import { BattleCard } from "./battle-card";
import { FamilyGarden } from "./family-garden";
import { TodayLogSheet } from "./today-log-sheet";
import { FoodLogger } from "@/components/foods/food-logger";
import { PortionSheet } from "@/components/foods/portion-sheet";
import { AddFoodSheet } from "@/components/foods/add-food-sheet";
import { Confetti } from "@/components/ui/confetti";
import {
  enqueue,
  installOutboxFlusher,
  removeFromOutbox,
} from "@/lib/offline/outbox";
import type { DashboardData, LoggerFood, TodayEntry } from "@/lib/domain/views";
import { FIVE_A_DAY, PORTION_UNITS, type PortionSize } from "@/lib/domain/scoring";
import type { EntryResponse } from "@/app/api/entries/route";

type ToastState = {
  lines: string[];
  undo: { clientEventId: string; entryId: string | null; units: number } | null;
  syncing: boolean;
};

type Celebration = { kind: "five" | "discovery"; title: string; sub: string };

export function BattleScreen({
  data,
  foods,
}: {
  data: DashboardData;
  foods: LoggerFood[];
}) {
  const router = useRouter();
  const [todayTotal, setTodayTotal] = useState(data.today.total);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>(
    data.today.entries,
  );
  const [picked, setPicked] = useState<LoggerFood | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when the server re-renders after refresh()
  // (React's "adjust state when props change" render-phase pattern).
  const [syncedToday, setSyncedToday] = useState(data.today);
  if (syncedToday !== data.today) {
    setSyncedToday(data.today);
    setTodayTotal(data.today.total);
    setTodayEntries(data.today.entries);
  }

  useEffect(() => {
    installOutboxFlusher(() => router.refresh());
  }, [router]);

  const showToast = useCallback((state: ToastState, ms = 6000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(state);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const celebrate = useCallback((c: Celebration) => {
    setCelebration(c);
    setConfettiKey((k) => k + 1);
    setTimeout(() => setCelebration(null), 2600);
  }, []);

  const logFood = useCallback(
    async (food: LoggerFood, size: PortionSize) => {
      setPicked(null);
      const clientEventId = crypto.randomUUID();
      const units = PORTION_UNITS[size];
      const consumedAt = new Date().toISOString();
      const before = todayTotal;

      // Optimistic: score moves instantly.
      setTodayTotal((t) => Math.round((t + units) * 10) / 10);
      setTodayEntries((entries) => [
        {
          id: clientEventId, // provisional until the server replies
          foodName: food.name,
          emoji: food.emoji,
          iconUrl: food.iconUrl,
          portionSize: size,
          portionUnits: units,
          category: food.category,
          clientEventId,
        },
        ...entries,
      ]);
      if (navigator.vibrate) navigator.vibrate(30);

      const optimisticLine = `+${formatUnits(units)} ${food.name.toUpperCase()}`;
      showToast({
        lines: [optimisticLine],
        undo: { clientEventId, entryId: null, units },
        syncing: true,
      });

      try {
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foodId: food.id,
            portionSize: size,
            clientEventId,
            consumedAt,
          }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const result = (await res.json()) as EntryResponse;

        setTodayTotal(result.todayTotal);
        setTodayEntries((entries) =>
          entries.map((e) =>
            e.clientEventId === clientEventId
              ? { ...e, id: result.entryId }
              : e,
          ),
        );

        const lines = [optimisticLine, result.messages.log];
        if (result.messages.movement) lines.push(result.messages.movement);
        showToast({
          lines,
          undo: { clientEventId, entryId: result.entryId, units },
          syncing: false,
        });

        if (result.messages.discovery) {
          celebrate({
            kind: "discovery",
            title: "NEW DISCOVERY!",
            sub: `${food.name.toUpperCase()} HAS ENTERED THE BATTLE.`,
          });
        } else if (before < FIVE_A_DAY && result.todayTotal >= FIVE_A_DAY) {
          celebrate({
            kind: "five",
            title: "FIVE ACHIEVED!",
            sub: "The vegetables acknowledge your greatness.",
          });
        }

        router.refresh();
      } catch {
        // Offline or flaky: keep it queued; the outbox will sync it.
        enqueue({ clientEventId, foodId: food.id, portionSize: size, consumedAt });
        showToast(
          {
            lines: [optimisticLine, "Saved on your phone — syncing…"],
            undo: { clientEventId, entryId: null, units },
            syncing: true,
          },
          8000,
        );
      }
    },
    [todayTotal, showToast, celebrate, router],
  );

  const undo = useCallback(async () => {
    if (!toast?.undo) return;
    const { clientEventId, entryId, units } = toast.undo;
    setToast(null);
    setTodayTotal((t) => Math.round((t - units) * 10) / 10);
    setTodayEntries((entries) =>
      entries.filter((e) => e.clientEventId !== clientEventId),
    );
    // If it never left the phone, just drop it from the outbox.
    removeFromOutbox(clientEventId);
    if (entryId) {
      try {
        await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
        router.refresh();
      } catch {
        // The entry may sync later; management repair can fix stragglers.
      }
    }
  }, [toast, router]);

  const deleteEntry = useCallback(
    async (entry: TodayEntry) => {
      setTodayEntries((entries) =>
        entries.filter((e) => e.clientEventId !== entry.clientEventId),
      );
      setTodayTotal((t) => Math.round((t - entry.portionUnits) * 10) / 10);
      removeFromOutbox(entry.clientEventId);
      if (entry.id !== entry.clientEventId) {
        try {
          await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
          router.refresh();
        } catch {
          // handled by refresh later
        }
      }
    },
    [router],
  );

  const resizeEntry = useCallback(
    async (entry: TodayEntry, size: PortionSize) => {
      if (entry.portionSize === size) return;
      const delta = PORTION_UNITS[size] - entry.portionUnits;
      setTodayEntries((entries) =>
        entries.map((e) =>
          e.clientEventId === entry.clientEventId
            ? { ...e, portionSize: size, portionUnits: PORTION_UNITS[size] }
            : e,
        ),
      );
      setTodayTotal((t) => Math.round((t + delta) * 10) / 10);
      if (entry.id !== entry.clientEventId) {
        try {
          await fetch(`/api/entries/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portionSize: size }),
          });
          router.refresh();
        } catch {
          // refresh will reconcile
        }
      }
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      {data.pendingSpins.length > 0 ? (
        <Link
          href={`/prizes/spin/${data.pendingSpins[0].battleId}`}
          className="pressable card-sticker animate-bounce-in block bg-custard px-4 py-3 text-center"
        >
          <span className="font-display block text-xl">
            👑 YOU WON {data.pendingSpins[0].battleEmoji}{" "}
            {data.pendingSpins[0].battleName.toUpperCase()}!
          </span>
          <span className="font-display text-sm text-ink-soft">
            SPIN FOR GLORY →
          </span>
        </Link>
      ) : data.lastResult ? (
        <Link
          href={`/battle/result/${data.lastResult.battleId}`}
          className="pressable block rounded-2xl border-[3px] border-ink bg-blueberry-light px-4 py-2 text-center text-sm font-bold shadow-sticker-sm"
        >
          {data.lastResult.winners.length > 0 ? (
            <>
              👑 Last week&apos;s {data.lastResult.name}:{" "}
              {data.lastResult.winners.map((w) => w.name).join(" & ")} — see the
              result →
            </>
          ) : (
            <>Last week ended with no champion. See the wreckage →</>
          )}
        </Link>
      ) : null}

      <TodayProgress total={todayTotal} onOpenLog={() => setLogOpen(true)} />
      <BattleCard battle={data.battle} />
      <FamilyGarden total={data.family.total} target={data.family.target} />
      <FoodLogger
        foods={foods}
        onPick={setPicked}
        onAddFood={() => setAddOpen(true)}
      />

      <PortionSheet food={picked} onClose={() => setPicked(null)} onLog={logFood} />
      <AddFoodSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(message) => {
          showToast({ lines: [message], undo: null, syncing: false });
          router.refresh();
        }}
      />
      <TodayLogSheet
        open={logOpen}
        entries={todayEntries}
        onClose={() => setLogOpen(false)}
        onDelete={deleteEntry}
        onResize={resizeEntry}
      />

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md animate-bounce-in"
        >
          <div className="card-sticker flex items-center gap-3 bg-ink px-4 py-3 text-cream">
            <div className="flex-1">
              {toast.lines.map((line, i) => (
                <p
                  key={i}
                  className={i === 0 ? "font-display text-sm" : "text-xs font-bold opacity-80"}
                >
                  {line}
                </p>
              ))}
            </div>
            {toast.undo ? (
              <button
                onClick={undo}
                className="pressable rounded-xl border-2 border-cream px-3 py-1.5 font-display text-sm"
              >
                UNDO
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {celebration ? (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          aria-live="assertive"
        >
          <Confetti key={confettiKey} />
          <div className="card-sticker animate-pop mx-6 bg-custard px-6 py-5 text-center">
            <p className="font-display text-3xl">{celebration.title}</p>
            <p className="pt-1 text-sm font-bold text-ink-soft">
              {celebration.sub}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
