"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Confetti } from "@/components/ui/confetti";
import { formatLocalDate } from "@/lib/domain/dates";
import type { WalletTicket } from "@/lib/domain/views";

/**
 * A prize ticket: a tangible collectible. Unused tickets belonging to the
 * viewer carry the big CASH IT IN button with confirmation; cashing in
 * stamps the ticket with a satisfying wallop.
 */
export function TicketCard({
  ticket,
  isYou,
}: {
  ticket: WalletTicket;
  isYou: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(ticket.status);

  const used = localStatus === "cashed_in";

  const cashIn = async () => {
    setConfirming(false);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/cash-in`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "The stamp jammed. Try again.");
        return;
      }
      setStamping(true);
      if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
      setLocalStatus("cashed_in");
      setTimeout(() => router.refresh(), 1600);
    } catch {
      setError("Battle HQ is unreachable. The ticket is still yours — try again.");
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-[3px] border-ink transition-all ${
        used ? "bg-cream opacity-80" : "bg-custard-light shadow-sticker"
      } ${stamping ? "animate-wiggle" : ""}`}
    >
      {/* perforation */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-12 border-l-[3px] border-dashed border-ink/40"
      />
      <div className="flex items-stretch">
        <div className="flex w-12 shrink-0 items-center justify-center bg-tomato text-2xl">
          🎟️
        </div>
        <div className="flex-1 px-3.5 py-3">
          <p className="font-display text-lg leading-tight">
            {ticket.emoji} {ticket.title}
          </p>
          <p className="pt-0.5 text-[11px] font-bold text-ink-soft">
            Won by becoming {ticket.wonFor} champion · week beginning{" "}
            {formatLocalDate(ticket.weekStart, { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {used ? (
            <p className="font-display pt-1 text-xs text-ink-soft">
              ✅ CASHED IN
              {ticket.cashedInAt
                ? ` — ${formatLocalDate(ticket.cashedInAt.slice(0, 10), { day: "numeric", month: "short" })}`
                : ""}
            </p>
          ) : (
            <p className="font-display pt-1 text-xs text-broccoli-dark">
              UNUSED — glory awaits
            </p>
          )}
        </div>
      </div>

      {isYou && !used ? (
        <div className="border-t-[3px] border-ink px-3 py-2.5">
          {confirming ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs font-bold">
                Cash in “{ticket.title}”?
              </p>
              <button
                onClick={cashIn}
                className="pressable rounded-xl border-2 border-ink bg-broccoli px-3 py-1.5 font-display text-xs text-white"
              >
                YES, DO IT
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="pressable rounded-xl border-2 border-ink bg-paper px-2.5 py-1.5 text-xs font-bold"
              >
                Not yet
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="pressable w-full rounded-xl border-[2.5px] border-ink bg-tomato py-2 text-center font-display text-lg text-white"
            >
              CASH IT IN
            </button>
          )}
          {error ? (
            <p role="alert" className="pt-2 text-center text-xs font-bold text-tomato">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {stamping ? (
        <>
          <Confetti count={20} />
          <div className="animate-pop pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-12deg] rounded-xl border-4 border-tomato px-4 py-1 font-display text-3xl text-tomato">
              CASHED IN
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
