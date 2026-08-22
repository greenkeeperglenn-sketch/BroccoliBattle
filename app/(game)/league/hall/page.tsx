import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { getHallOfGlory } from "@/lib/domain/views";
import { formatWeekRange } from "@/lib/domain/dates";
import { formatUnits } from "@/components/battle/today-progress";

export const dynamic = "force-dynamic";

export default async function HallOfGloryPage() {
  const session = (await getCurrentMember())!;
  const db = await getDb();
  const glory = await getHallOfGlory(db, session);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-center text-2xl tracking-wide">
        🏛️ HALL OF GLORY
      </h1>

      {glory.weeks.length === 0 ? (
        <p className="card-sticker px-4 py-8 text-center text-sm font-bold text-ink-soft">
          History has not yet been written. Finish a week and it begins.
        </p>
      ) : (
        <>
          {(glory.lifetime.mostCrowns.length > 0 ||
            glory.lifetime.mostSpins.length > 0) ? (
            <section className="card-sticker bg-custard-light px-4 py-3">
              <h2 className="font-display pb-1 text-xs tracking-widest text-ink-soft">
                LIFETIME RECORDS
              </h2>
              <div className="flex flex-col gap-0.5 text-sm font-bold">
                {glory.lifetime.mostCrowns[0] ? (
                  <p>
                    👑 Most crowns: {glory.lifetime.mostCrowns[0].name} —{" "}
                    {glory.lifetime.mostCrowns[0].count}
                  </p>
                ) : null}
                {glory.lifetime.mostSpins[0] ? (
                  <p>
                    🎡 Prize spins: {glory.lifetime.mostSpins[0].name} —{" "}
                    {glory.lifetime.mostSpins[0].count}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <ol className="flex flex-col gap-3">
            {glory.weeks.map((week) => (
              <li key={week.battleId} className="card-sticker overflow-hidden">
                <div className="flex items-center justify-between border-b-[3px] border-ink bg-cream px-4 py-1.5">
                  <span className="font-display text-xs tracking-widest text-ink-soft">
                    {formatWeekRange(week.weekStart)}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <p className="font-display text-xl">
                    {week.emoji} {week.name}
                  </p>
                  {week.winners.length > 0 ? (
                    <p className="pt-0.5 text-sm font-bold">
                      👑 {week.winners.map((w) => w.name).join(" & ")}
                      <span className="text-xs text-ink-soft">
                        {" "}
                        · {formatUnits(week.winners[0].score)}
                      </span>
                    </p>
                  ) : (
                    <p className="pt-0.5 text-sm font-bold text-ink-soft">
                      No champion. A dark week.
                    </p>
                  )}
                  {week.prizes.map((p, i) => (
                    <p key={i} className="text-xs font-bold text-ink-soft">
                      🎡 {p.winner} won: {p.emoji} {p.title}
                    </p>
                  ))}
                  {week.report ? (
                    <p className="pt-2 text-xs font-bold leading-relaxed text-ink-soft">
                      {week.report}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
