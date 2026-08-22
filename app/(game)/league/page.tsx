import Link from "next/link";
import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { getLeague, type LeaguePeriod } from "@/lib/domain/views";
import { Avatar } from "@/components/ui/avatar";
import { formatUnits } from "@/lib/format";

export const dynamic = "force-dynamic";

const PERIODS: { key: LeaguePeriod; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: LeaguePeriod =
    rawPeriod === "month" || rawPeriod === "all" ? rawPeriod : "week";
  const session = (await getCurrentMember())!;
  const db = await getDb();
  const league = await getLeague(db, session, period);

  const sorted = [...league.members].sort(
    (a, b) => b.stats.totalPortions - a.stats.totalPortions,
  );
  const best = sorted[0]?.stats.totalPortions ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-center text-2xl tracking-wide">
        🏆 FAMILY LEAGUE
      </h1>

      <nav className="grid grid-cols-3 gap-2" aria-label="Period">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/league?period=${p.key}`}
            aria-current={p.key === period ? "page" : undefined}
            className={`pressable rounded-2xl border-[3px] border-ink py-2 text-center font-display text-sm ${
              p.key === period ? "bg-custard shadow-sticker-sm" : "bg-paper opacity-60"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        {sorted.map((m, i) => (
          <article
            key={m.id}
            className={`card-sticker overflow-hidden ${m.isYou ? "bg-custard-light" : ""}`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="font-display w-6 text-center text-xl" aria-hidden="true">
                {i === 0 && best > 0 ? "👑" : i + 1}
              </span>
              <Avatar name={m.name} style={m.avatarStyle} size="lg" />
              <div className="flex-1">
                <p className="font-display text-lg leading-tight">
                  {m.name}
                  {m.isYou ? (
                    <span className="text-xs text-ink-soft"> (you)</span>
                  ) : null}
                </p>
                <p className="text-xs font-bold text-ink-soft">
                  🥦 {formatUnits(m.stats.vegPortions)} veg · 🍓{" "}
                  {formatUnits(m.stats.fruitPortions)} fruit · 🌈{" "}
                  {m.stats.distinctFoods} foods
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl leading-none">
                  {formatUnits(m.stats.totalPortions)}
                </p>
                <p className="text-[10px] font-bold text-ink-soft">portions</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 border-t-2 border-ink/10 px-4 py-2 text-[11px] font-bold text-ink-soft">
              <span>⭐ {m.stats.fiveADayDays} days of five</span>
              <span>🔥 {m.stats.longestStreak} streak</span>
              <span>👑 {m.stats.battleWins} wins</span>
              {m.stats.perfectWeeks > 0 ? (
                <span>🏅 {m.stats.perfectWeeks} perfect {m.stats.perfectWeeks === 1 ? "week" : "weeks"}</span>
              ) : null}
            </div>
            {m.achievements.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t-2 border-ink/10 px-4 py-2">
                {m.achievements.map((a) => (
                  <span
                    key={a.code}
                    title={`${a.name}: ${a.description}`}
                    className="rounded-full border-2 border-ink bg-paper px-2 py-0.5 text-[10px] font-bold"
                  >
                    {a.emoji} {a.name}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="card-sticker overflow-hidden">
        <h2 className="font-display border-b-[3px] border-ink bg-blueberry px-4 py-2 text-sm tracking-widest text-white">
          CURRENT TITLE HOLDERS
        </h2>
        <ul>
          {league.titles.map((t) => (
            <li
              key={t.code}
              className="flex items-center justify-between border-b-2 border-ink/10 px-4 py-2 text-sm last:border-b-0"
            >
              <span className="font-display">
                {t.emoji} {t.name}
              </span>
              {t.holders.length > 0 ? (
                <span className="font-bold">
                  {t.holders.join(" & ")}{" "}
                  <span className="text-xs text-ink-soft">
                    ({formatUnits(t.value)} {t.unit})
                  </span>
                </span>
              ) : (
                <span className="text-xs font-bold text-ink-soft">
                  unclaimed
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/league/hall"
        className="pressable card-sticker block bg-blueberry-light px-4 py-3 text-center font-display"
      >
        🏛️ HALL OF GLORY →
      </Link>
    </div>
  );
}
