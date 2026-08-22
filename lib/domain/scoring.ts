import type { ResultDetail } from "@/lib/db/schema";
import type { LocalDate } from "./dates";

/**
 * Pure scoring rules. Everything here operates on plain entry-shaped
 * objects so it can be unit-tested without a database.
 *
 * Portion values: SMALL 0.5 · FIST 1.0 · MONSTER 1.5.
 * Each entry stores the units it scored at the time — these functions never
 * re-derive units from current settings.
 */

export const PORTION_UNITS = {
  small: 0.5,
  fist: 1.0,
  monster: 1.5,
} as const;

export type PortionSize = keyof typeof PORTION_UNITS;

export const FIVE_A_DAY = 5;

export type ScoringEntry = {
  memberId: string;
  foodId: string;
  categorySnapshot: "fruit" | "veg";
  portionUnits: number;
  consumedLocalDate: LocalDate;
};

export type FoodPolicy = {
  qualifiesForDailyTarget: boolean;
  dailyContributionCap: number | null;
};

/**
 * Units that count towards the daily five for one member-day, honouring
 * per-food policy (qualification and daily caps). With no policy map every
 * entry counts in full — the V1 catalogue is all ordinary fruit and veg.
 */
export function dailyQualifyingUnits(
  dayEntries: ScoringEntry[],
  policies?: Map<string, FoodPolicy>,
): number {
  if (!policies) {
    return round1(dayEntries.reduce((sum, e) => sum + e.portionUnits, 0));
  }
  const perFood = new Map<string, number>();
  for (const e of dayEntries) {
    const policy = policies.get(e.foodId);
    if (policy && !policy.qualifiesForDailyTarget) continue;
    perFood.set(e.foodId, (perFood.get(e.foodId) ?? 0) + e.portionUnits);
  }
  let total = 0;
  for (const [foodId, units] of perFood) {
    const cap = policies.get(foodId)?.dailyContributionCap;
    total += cap != null ? Math.min(units, cap) : units;
  }
  return round1(total);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Total units per local date. */
export function dailyTotals(
  entries: ScoringEntry[],
  policies?: Map<string, FoodPolicy>,
): Map<LocalDate, number> {
  const byDay = new Map<LocalDate, ScoringEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.consumedLocalDate) ?? [];
    list.push(e);
    byDay.set(e.consumedLocalDate, list);
  }
  const totals = new Map<LocalDate, number>();
  for (const [day, dayEntries] of byDay) {
    totals.set(day, dailyQualifyingUnits(dayEntries, policies));
  }
  return totals;
}

export function totalPortions(entries: ScoringEntry[]): number {
  return round1(entries.reduce((sum, e) => sum + e.portionUnits, 0));
}

export function categoryPortions(
  entries: ScoringEntry[],
  category: "fruit" | "veg",
): number {
  return totalPortions(entries.filter((e) => e.categorySnapshot === category));
}

/** Distinct foods eaten — the same food twice only counts once. */
export function distinctFoods(entries: ScoringEntry[]): number {
  return new Set(entries.map((e) => e.foodId)).size;
}

/** Number of days in the given range that reached five. */
export function fiveADayDays(
  entries: ScoringEntry[],
  dates: LocalDate[],
): number {
  const totals = dailyTotals(entries);
  return dates.filter((d) => (totals.get(d) ?? 0) >= FIVE_A_DAY).length;
}

/**
 * Longest run of consecutive five-a-day days within the given ordered
 * date range.
 */
export function longestFiveStreak(
  entries: ScoringEntry[],
  dates: LocalDate[],
): number {
  const totals = dailyTotals(entries);
  let best = 0;
  let run = 0;
  for (const d of dates) {
    if ((totals.get(d) ?? 0) >= FIVE_A_DAY) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/** Every one of the seven days reached five. */
export function isPerfectWeek(
  entries: ScoringEntry[],
  weekDates: LocalDate[],
): boolean {
  return weekDates.length === 7 && fiveADayDays(entries, weekDates) === 7;
}

// ─── Challenge scoring ──────────────────────────────────────────────────────

export type ChallengeMetric =
  | "veg_portions"
  | "fruit_portions"
  | "distinct_foods"
  | "five_a_day_days"
  | "total_portions"
  | "five_a_day_streak";

/**
 * Deterministic score for one member's entries under a challenge metric.
 * `dates` is the week's seven local dates, Monday first.
 */
export function challengeScore(
  metric: ChallengeMetric,
  entries: ScoringEntry[],
  dates: LocalDate[],
): number {
  switch (metric) {
    case "veg_portions":
      return categoryPortions(entries, "veg");
    case "fruit_portions":
      return categoryPortions(entries, "fruit");
    case "distinct_foods":
      return distinctFoods(entries);
    case "five_a_day_days":
      return fiveADayDays(entries, dates);
    case "total_portions":
      return totalPortions(entries);
    case "five_a_day_streak":
      return longestFiveStreak(entries, dates);
  }
}

export function memberResultDetail(
  entries: ScoringEntry[],
  dates: LocalDate[],
): ResultDetail {
  return {
    vegPortions: categoryPortions(entries, "veg"),
    fruitPortions: categoryPortions(entries, "fruit"),
    totalPortions: totalPortions(entries),
    distinctFoods: distinctFoods(entries),
    fiveADayDays: fiveADayDays(entries, dates),
    longestStreak: longestFiveStreak(entries, dates),
  };
}

// ─── Ranking ────────────────────────────────────────────────────────────────

export type RankedResult = {
  memberId: string;
  score: number;
  rank: number;
  winner: boolean;
};

/**
 * Standard competition ranking (1, 1, 3…). Winners are everyone on rank 1
 * with a score above zero — a genuine tie produces joint champions, and an
 * all-zero week produces no champion at all.
 */
export function rankMembers(
  scores: { memberId: string; score: number }[],
): RankedResult[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const results: RankedResult[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const rank =
      i > 0 && sorted[i].score === sorted[i - 1].score
        ? results[i - 1].rank
        : i + 1;
    results.push({
      memberId: sorted[i].memberId,
      score: sorted[i].score,
      rank,
      winner: rank === 1 && sorted[i].score > 0,
    });
  }
  return results;
}
