import { Avatar } from "@/components/ui/avatar";
import { formatUnits } from "./today-progress";
import type { DashboardData } from "@/lib/domain/views";

const METRIC_UNITS: Record<string, string> = {
  veg_portions: "veg portions",
  fruit_portions: "fruit portions",
  distinct_foods: "different foods",
  five_a_day_days: "days of five",
  total_portions: "portions",
  five_a_day_streak: "day streak",
};

/** This week's battle: title, rules, live standings. */
export function BattleCard({ battle }: { battle: DashboardData["battle"] }) {
  return (
    <section className="card-sticker overflow-hidden">
      <div className="bg-blueberry px-4 py-3 text-white">
        <p className="font-display text-xs tracking-widest opacity-80">
          THIS WEEK&apos;S BATTLE
        </p>
        <h2 className="font-display text-3xl leading-tight">
          <span aria-hidden="true">{battle.emoji}</span> {battle.name.toUpperCase()}
        </h2>
        <p className="text-xs font-bold opacity-90">{battle.description}</p>
      </div>
      <ol className="divide-y-2 divide-ink/10">
        {battle.standings.map((s) => (
          <li
            key={s.memberId}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              s.isYou ? "bg-custard-light" : ""
            }`}
          >
            <span className="font-display w-6 text-center text-lg" aria-hidden="true">
              {s.rank === 1 && s.score > 0 ? "👑" : s.rank}
            </span>
            <Avatar name={s.name} style={s.avatarStyle} size="sm" />
            <span className="flex-1 truncate font-bold">
              {s.name}
              {s.isYou ? (
                <span className="text-xs text-ink-soft"> (you)</span>
              ) : null}
            </span>
            <span className="font-display text-xl">
              {formatUnits(s.score)}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t-2 border-ink/10 px-4 py-2 text-center text-[11px] font-bold text-ink-soft">
        Scored in {METRIC_UNITS[battle.metric] ?? "points"} · Monday to Sunday
      </p>
    </section>
  );
}
