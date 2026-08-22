import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { getBattleResult } from "@/lib/domain/views";
import { formatWeekRange } from "@/lib/domain/dates";
import { Avatar } from "@/components/ui/avatar";
import { Confetti } from "@/components/ui/confetti";
import { TicketCard } from "@/components/prizes/ticket-card";
import { formatUnits } from "@/lib/format";

export const dynamic = "force-dynamic";

/** End-of-week reveal: crowns, podium, commentary and the spin CTA. */
export default async function ResultPage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = await params;
  const session = (await getCurrentMember())!;
  const db = await getDb();
  const view = await getBattleResult(db, session, battleId);
  if (!view) notFound();

  const winners = view.standings.filter((s) => s.winner);
  const losers = view.standings.filter((s) => !s.winner);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {winners.length > 0 ? <Confetti count={30} /> : null}

      <div className="text-center">
        <p className="font-display text-xs tracking-widest text-ink-soft">
          {formatWeekRange(view.weekStart)}
        </p>
        <h1 className="font-display text-3xl">
          <span aria-hidden="true">👑 {view.emoji}</span>{" "}
          {view.name.toUpperCase()}{" "}
          <span aria-hidden="true">👑</span>
        </h1>
      </div>

      {winners.length === 0 ? (
        <div className="card-sticker px-5 py-6 text-center">
          <p className="text-4xl" aria-hidden="true">🫥</p>
          <p className="font-display pt-2 text-xl">NO CHAMPION</p>
          <p className="pt-1 text-sm font-bold text-ink-soft">
            Nobody scored. The crown stays in its box. The broccoli is
            disappointed but not surprised.
          </p>
        </div>
      ) : (
        <div className="card-sticker animate-bounce-in overflow-hidden">
          <div className="bg-custard px-5 py-5 text-center">
            {winners.length > 1 ? (
              <p className="font-display text-lg">JOINT CHAMPIONS</p>
            ) : null}
            <div className="flex items-center justify-center gap-4 pt-1">
              {winners.map((w) => (
                <div key={w.name} className="flex flex-col items-center">
                  <span className="animate-float text-3xl" aria-hidden="true">👑</span>
                  <Avatar name={w.name} style={w.avatarStyle} size="xl" />
                  <p className="font-display pt-1 text-2xl">
                    {w.name.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
            <p className="font-display pt-1 text-lg">
              {formatUnits(winners[0].score)} {scoreUnit(view.metric)}
            </p>
            <p className="text-xs font-bold text-ink-soft">
              The broccoli nation salutes {winners.length > 1 ? "them" : "you"}.
            </p>
          </div>

          {view.youWon && !view.yourSpinUsed ? (
            <Link
              href={`/prizes/spin/${view.battleId}`}
              className="pressable block border-t-[3px] border-ink bg-tomato px-4 py-4 text-center font-display text-2xl text-white"
            >
              SPIN FOR GLORY →
            </Link>
          ) : null}
        </div>
      )}

      {view.ticket ? <TicketCard ticket={view.ticket} isYou={view.youWon} /> : null}

      {losers.length > 0 ? (
        <section className="card-sticker overflow-hidden">
          <h2 className="font-display border-b-[3px] border-ink bg-cream px-4 py-2 text-sm tracking-widest text-ink-soft">
            THE DEFEATED
          </h2>
          <ol>
            {losers.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-3 border-b-2 border-ink/10 px-4 py-2 last:border-b-0"
              >
                <span className="font-display w-5 text-center">{s.rank}</span>
                <Avatar name={s.name} style={s.avatarStyle} size="sm" />
                <span className="flex-1 font-bold">
                  {s.name}
                  {s.isYou ? <span className="text-xs text-ink-soft"> (you)</span> : null}
                </span>
                <span className="font-display">{formatUnits(s.score)}</span>
                <span aria-hidden="true" className="text-sm">😵</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {view.report ? (
        <section className="card-sticker bg-blueberry-light px-4 py-3">
          <h2 className="font-display pb-1 text-xs tracking-widest text-ink-soft">
            📰 THE WEEKLY BATTLE REPORT
          </h2>
          <p className="text-sm font-bold leading-relaxed">{view.report}</p>
        </section>
      ) : null}

      <Link
        href="/league/hall"
        className="text-center font-display text-sm text-blueberry underline underline-offset-2"
      >
        Visit the Hall of Glory →
      </Link>
    </div>
  );
}

function scoreUnit(metric: string): string {
  switch (metric) {
    case "veg_portions": return "vegetable portions";
    case "fruit_portions": return "fruit portions";
    case "distinct_foods": return "different foods";
    case "five_a_day_days": return "days of five";
    case "total_portions": return "portions";
    case "five_a_day_streak": return "days running";
    default: return "points";
  }
}
