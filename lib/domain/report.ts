import type { ChallengeSnapshot } from "@/lib/db/schema";
import type { ScoringEntry } from "./scoring";

/**
 * Weekly battle commentary. The deterministic templated version below always
 * works; when a text AI is configured the API layer may replace it with a
 * generated one (once, stored — never regenerated per request).
 */

export type ReportInput = {
  challenge: ChallengeSnapshot;
  standings: { name: string; score: number; rank: number; winner: boolean }[];
  familyTotal: number;
  familyTarget: number;
  entries: ScoringEntry[];
};

function formatScore(metric: ChallengeSnapshot["metric"], score: number): string {
  switch (metric) {
    case "veg_portions":
      return `${score} vegetable portions`;
    case "fruit_portions":
      return `${score} fruit portions`;
    case "distinct_foods":
      return `${score} different foods`;
    case "five_a_day_days":
      return `${score} five-a-day days`;
    case "total_portions":
      return `${score} portions`;
    case "five_a_day_streak":
      return `a ${score}-day streak`;
  }
}

export function buildTemplatedReport(input: ReportInput): string {
  const { challenge, standings, familyTotal, familyTarget } = input;
  const winners = standings.filter((s) => s.winner);
  const lines: string[] = [];

  if (winners.length === 0) {
    lines.push(
      `Nobody scored a single point in ${challenge.name}. The broccoli is speechless. There is no champion this week, which suits nobody.`,
    );
  } else if (winners.length === 1) {
    const w = winners[0];
    lines.push(
      `${w.name} conquered ${challenge.name} with ${formatScore(challenge.metric, w.score)}.`,
    );
    const runnerUp = standings.find((s) => s.rank > 1);
    if (runnerUp) {
      lines.push(
        `${runnerUp.name} finished ${ordinal(runnerUp.rank)} with ${formatScore(challenge.metric, runnerUp.score)}. Close, but history only remembers champions.`,
      );
    }
  } else {
    lines.push(
      `${joinNames(winners.map((w) => w.name))} are JOINT CHAMPIONS of ${challenge.name} with ${formatScore(challenge.metric, winners[0].score)} each. The crown will simply have to be shared.`,
    );
  }

  const total = Math.round(familyTotal * 10) / 10;
  if (total >= familyTarget) {
    lines.push(
      `The family smashed ${total} of ${familyTarget} portions. Absolute scenes.`,
    );
  } else if (total >= familyTarget * 0.75) {
    lines.push(
      `The family reached ${total} of ${familyTarget} portions. Respectable.`,
    );
  } else if (total > 0) {
    lines.push(
      `The family managed ${total} of ${familyTarget} portions. The vegetables have noted this down.`,
    );
  }

  const distinct = new Set(input.entries.map((e) => e.foodId)).size;
  if (distinct >= 15) {
    lines.push(
      `${distinct} different foods were eaten this week. The collection grows.`,
    );
  }

  return lines.join(" ");
}

export function ordinal(n: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const v = n % 100;
  return `${n}${v >= 11 && v <= 13 ? "th" : (suffixes[n % 10] ?? "th")}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
