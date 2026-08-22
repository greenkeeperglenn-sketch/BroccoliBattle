import {
  categoryPortions,
  distinctFoods,
  fiveADayDays,
  longestFiveStreak,
  totalPortions,
  type ScoringEntry,
} from "./scoring";
import type { LocalDate } from "./dates";

/**
 * League aggregates. Pure — takes entries plus already-counted battle facts
 * and returns the numbers the League screen and achievements need.
 */

export type StatsEntry = ScoringEntry & {
  portionSize?: "small" | "fist" | "monster";
};

export type MemberStats = {
  memberId: string;
  totalPortions: number;
  vegPortions: number;
  fruitPortions: number;
  fiveADayDays: number;
  longestStreak: number;
  distinctFoods: number;
  distinctVeg: number;
  distinctFruit: number;
  monsterPortions: number;
  battleWins: number;
  ticketsWon: number;
  perfectWeeks: number;
};

export function computeMemberStats(args: {
  memberId: string;
  entries: StatsEntry[];
  /** Ordered local dates covering the period (for day/streak counting). */
  dates: LocalDate[];
  battleWins?: number;
  ticketsWon?: number;
  perfectWeeks?: number;
}): MemberStats {
  const { entries, dates } = args;
  return {
    memberId: args.memberId,
    totalPortions: totalPortions(entries),
    vegPortions: categoryPortions(entries, "veg"),
    fruitPortions: categoryPortions(entries, "fruit"),
    fiveADayDays: fiveADayDays(entries, dates),
    longestStreak: longestFiveStreak(entries, dates),
    distinctFoods: distinctFoods(entries),
    distinctVeg: distinctFoods(entries.filter((e) => e.categorySnapshot === "veg")),
    distinctFruit: distinctFoods(entries.filter((e) => e.categorySnapshot === "fruit")),
    monsterPortions: entries.filter((e) => e.portionSize === "monster").length,
    battleWins: args.battleWins ?? 0,
    ticketsWon: args.ticketsWon ?? 0,
    perfectWeeks: args.perfectWeeks ?? 0,
  };
}

// ─── Permanent championship titles ──────────────────────────────────────────

export type Title = {
  code: string;
  name: string;
  emoji: string;
  metric: keyof Omit<MemberStats, "memberId">;
  /** Formats the leading value for display. */
  unit: string;
};

export const TITLES: Title[] = [
  { code: "veg_champion", name: "Veg Champion", emoji: "🥦", metric: "vegPortions", unit: "veg portions" },
  { code: "fruit_champion", name: "Fruit Champion", emoji: "🍓", metric: "fruitPortions", unit: "fruit portions" },
  { code: "variety_champion", name: "Variety Champion", emoji: "🌈", metric: "distinctFoods", unit: "different foods" },
  { code: "streak_leader", name: "Streak Leader", emoji: "🔥", metric: "longestStreak", unit: "days running" },
  { code: "five_a_day_leader", name: "Five-a-Day Leader", emoji: "⭐", metric: "fiveADayDays", unit: "days of five" },
  { code: "most_battle_wins", name: "Most Battle Wins", emoji: "👑", metric: "battleWins", unit: "crowns" },
];

export type TitleHolder = {
  title: Title;
  memberIds: string[]; // joint holders on a tie
  value: number;
};

export function computeTitleHolders(stats: MemberStats[]): TitleHolder[] {
  return TITLES.map((title) => {
    let best = 0;
    for (const s of stats) best = Math.max(best, s[title.metric]);
    return {
      title,
      value: best,
      memberIds:
        best > 0
          ? stats.filter((s) => s[title.metric] === best).map((s) => s.memberId)
          : [],
    };
  });
}

// ─── Achievements ───────────────────────────────────────────────────────────

export type Achievement = {
  code: string;
  name: string;
  description: string;
  emoji: string;
  earned: (stats: MemberStats) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    code: "first_five",
    name: "First Five",
    description: "Reached five-a-day for the first time.",
    emoji: "⭐",
    earned: (s) => s.fiveADayDays >= 1,
  },
  {
    code: "hat_trick",
    name: "Hat-Trick",
    description: "Five-a-day three days running.",
    emoji: "🎩",
    earned: (s) => s.longestStreak >= 3,
  },
  {
    code: "perfect_week",
    name: "Perfect Week",
    description: "Five-a-day every single day, Monday to Sunday.",
    emoji: "🏅",
    earned: (s) => s.perfectWeeks >= 1,
  },
  {
    code: "ten_foods",
    name: "Menu Explorer",
    description: "Ten different foods eaten.",
    emoji: "🧭",
    earned: (s) => s.distinctFoods >= 10,
  },
  {
    code: "twenty_foods",
    name: "Produce Encyclopaedia",
    description: "Twenty different foods eaten.",
    emoji: "📚",
    earned: (s) => s.distinctFoods >= 20,
  },
  {
    code: "first_win",
    name: "First Crown",
    description: "Won a weekly battle.",
    emoji: "👑",
    earned: (s) => s.battleWins >= 1,
  },
  {
    code: "first_ticket",
    name: "Ticket Holder",
    description: "Won a prize ticket.",
    emoji: "🎟️",
    earned: (s) => s.ticketsWon >= 1,
  },
  {
    code: "first_monster",
    name: "Monster Muncher",
    description: "Logged a Monster portion.",
    emoji: "👹",
    earned: (s) => s.monsterPortions >= 1,
  },
];

export function earnedAchievements(stats: MemberStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.earned(stats));
}
