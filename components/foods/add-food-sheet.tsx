"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";

type AddResult =
  | { outcome: "created" | "existing"; food: { id: string; name: string }; message: string }
  | { outcome: "needs_category" }
  | { outcome: "rejected"; reason: string };

/** "+ CAN'T FIND IT?" — add a missing fruit or vegetable by name. */
export function AddFoodSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [needsCategory, setNeedsCategory] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName("");
    setNeedsCategory(false);
    setRejection(null);
    onClose();
  };

  const submit = async (categoryHint?: "fruit" | "veg") => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    setRejection(null);
    try {
      const res = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), categoryHint }),
      });
      const data = (await res.json()) as { ok: boolean } & AddResult;
      if (!res.ok || !data.ok) {
        setRejection("Battle HQ is unreachable. Try again in a moment.");
        return;
      }
      if (data.outcome === "needs_category") {
        setNeedsCategory(true);
        return;
      }
      if (data.outcome === "rejected") {
        setRejection(data.reason);
        return;
      }
      onAdded(
        data.outcome === "created"
          ? `${data.food.name} joins the battle!`
          : data.message,
      );
      close();
    } catch {
      setRejection("Battle HQ is unreachable. Your food idea is safe — try again soon.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} title="Can't find it?">
      <div className="flex flex-col gap-3 pb-4">
        <p className="text-center text-xs font-bold text-ink-soft">
          Name the fruit or veg and it joins the catalogue for everyone.
        </p>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNeedsCategory(false);
            setRejection(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="e.g. Dragon fruit"
          maxLength={40}
          autoFocus
          aria-label="Food name"
          className="rounded-2xl border-[3px] border-ink bg-paper px-4 py-3 font-bold outline-none placeholder:text-ink-soft/50"
        />

        {rejection ? (
          <p role="alert" className="card-sticker bg-tomato-light px-3 py-2 text-center text-sm font-bold">
            {rejection}
          </p>
        ) : null}

        {needsCategory ? (
          <div>
            <p className="pb-2 text-center text-sm font-bold">
              The scorekeeper doesn&apos;t know this one. Fruit or veg?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void submit("fruit")}
                disabled={busy}
                className="pressable card-sticker bg-tomato-light py-3 font-display"
              >
                🍓 FRUIT
              </button>
              <button
                onClick={() => void submit("veg")}
                disabled={busy}
                className="pressable card-sticker bg-broccoli-light py-3 font-display"
              >
                🥦 VEG
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => void submit()}
            disabled={busy || name.trim().length < 2}
            className="pressable card-sticker bg-broccoli py-3 font-display text-xl text-white disabled:opacity-50"
          >
            {busy ? "Consulting the council…" : "ADD IT"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
