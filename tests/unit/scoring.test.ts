import { describe, expect, it } from "vitest";
import {
  PORTION_UNITS,
  categoryPortions,
  challengeScore,
  dailyQualifyingUnits,
  dailyTotals,
  distinctFoods,
  fiveADayDays,
  isPerfectWeek,
  longestFiveStreak,
  rankMembers,
  totalPortions,
  type ScoringEntry,
} from "@/lib/domain/scoring";
import { weekDates } from "@/lib/domain/dates";

const WEEK = weekDates("2026-08-17");

function entry(
  overrides: Partial<ScoringEntry> & { consumedLocalDate: string },
): ScoringEntry {
  return {
    memberId: "m1",
    foodId: "broccoli",
    categorySnapshot: "veg",
    portionUnits: 1,
    ...overrides,
  };
}

describe("portion values", () => {
  it("small / fist / monster are 0.5 / 1 / 1.5", () => {
    expect(PORTION_UNITS.small).toBe(0.5);
    expect(PORTION_UNITS.fist).toBe(1.0);
    expect(PORTION_UNITS.monster).toBe(1.5);
  });
});

describe("daily totals and the five threshold", () => {
  it("sums a day's units", () => {
    const entries = [
      entry({ consumedLocalDate: "2026-08-17", portionUnits: 0.5 }),
      entry({ consumedLocalDate: "2026-08-17", portionUnits: 1.5 }),
      entry({ consumedLocalDate: "2026-08-18", portionUnits: 1 }),
    ];
    const totals = dailyTotals(entries);
    expect(totals.get("2026-08-17")).toBe(2);
    expect(totals.get("2026-08-18")).toBe(1);
  });

  it("4.5 is not five; 5 is; 7 still counts as one five-day", () => {
    const day = (units: number[]) =>
      units.map((u) => entry({ consumedLocalDate: "2026-08-17", portionUnits: u }));
    expect(fiveADayDays(day([1, 1, 1, 1, 0.5]), WEEK)).toBe(0);
    expect(fiveADayDays(day([1, 1, 1, 1, 1]), WEEK)).toBe(1);
    expect(fiveADayDays(day([1.5, 1.5, 1.5, 1.5, 1]), WEEK)).toBe(1);
  });
});

describe("category totals", () => {
  const entries = [
    entry({ consumedLocalDate: "2026-08-17", categorySnapshot: "veg", portionUnits: 2 }),
    entry({ consumedLocalDate: "2026-08-17", categorySnapshot: "fruit", portionUnits: 1.5, foodId: "apple" }),
    entry({ consumedLocalDate: "2026-08-18", categorySnapshot: "fruit", portionUnits: 0.5, foodId: "pear" }),
  ];
  it("veg total", () => {
    expect(categoryPortions(entries, "veg")).toBe(2);
  });
  it("fruit total", () => {
    expect(categoryPortions(entries, "fruit")).toBe(2);
  });
  it("overall total", () => {
    expect(totalPortions(entries)).toBe(4);
  });
});

describe("variety", () => {
  it("same food multiple times counts once", () => {
    const entries = [
      entry({ consumedLocalDate: "2026-08-17", foodId: "broccoli" }),
      entry({ consumedLocalDate: "2026-08-18", foodId: "broccoli" }),
      entry({ consumedLocalDate: "2026-08-18", foodId: "carrot" }),
    ];
    expect(distinctFoods(entries)).toBe(2);
  });
});

describe("streaks", () => {
  const five = (date: string) =>
    Array.from({ length: 5 }, () =>
      entry({ consumedLocalDate: date, portionUnits: 1 }),
    );
  it("counts consecutive five-days and resets on a miss", () => {
    const entries = [
      ...five("2026-08-17"),
      ...five("2026-08-18"),
      // gap Wednesday
      ...five("2026-08-20"),
      ...five("2026-08-21"),
      ...five("2026-08-22"),
    ];
    expect(longestFiveStreak(entries, WEEK)).toBe(3);
    expect(fiveADayDays(entries, WEEK)).toBe(5);
  });

  it("perfect week needs all seven days", () => {
    const sixDays = WEEK.slice(0, 6).flatMap(five);
    expect(isPerfectWeek(sixDays, WEEK)).toBe(false);
    const sevenDays = WEEK.flatMap(five);
    expect(isPerfectWeek(sevenDays, WEEK)).toBe(true);
  });
});

describe("food policy (qualification and caps)", () => {
  it("non-qualifying foods add nothing; caps limit a food's contribution", () => {
    const policies = new Map([
      ["juice", { qualifiesForDailyTarget: false, dailyContributionCap: null }],
      ["beans", { qualifiesForDailyTarget: true, dailyContributionCap: 1 }],
    ]);
    const day = [
      entry({ consumedLocalDate: "2026-08-17", foodId: "juice", portionUnits: 3 }),
      entry({ consumedLocalDate: "2026-08-17", foodId: "beans", portionUnits: 1.5 }),
      entry({ consumedLocalDate: "2026-08-17", foodId: "beans", portionUnits: 1 }),
      entry({ consumedLocalDate: "2026-08-17", foodId: "broccoli", portionUnits: 1 }),
    ];
    // beans capped at 1, juice ignored, broccoli full.
    expect(dailyQualifyingUnits(day, policies)).toBe(2);
  });
});

describe("challenge scoring", () => {
  const entries = [
    entry({ consumedLocalDate: "2026-08-17", categorySnapshot: "veg", foodId: "broccoli", portionUnits: 3 }),
    entry({ consumedLocalDate: "2026-08-17", categorySnapshot: "fruit", foodId: "apple", portionUnits: 2 }),
    entry({ consumedLocalDate: "2026-08-18", categorySnapshot: "veg", foodId: "carrot", portionUnits: 5 }),
  ];
  it("scores each metric deterministically", () => {
    expect(challengeScore("veg_portions", entries, WEEK)).toBe(8);
    expect(challengeScore("fruit_portions", entries, WEEK)).toBe(2);
    expect(challengeScore("distinct_foods", entries, WEEK)).toBe(3);
    expect(challengeScore("total_portions", entries, WEEK)).toBe(10);
    expect(challengeScore("five_a_day_days", entries, WEEK)).toBe(2);
    expect(challengeScore("five_a_day_streak", entries, WEEK)).toBe(2);
  });
});

describe("ranking and ties", () => {
  it("standard competition ranking with joint champions", () => {
    const ranked = rankMembers([
      { memberId: "a", score: 10 },
      { memberId: "b", score: 10 },
      { memberId: "c", score: 7 },
      { memberId: "d", score: 0 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3, 4]);
    expect(ranked.filter((r) => r.winner).map((r) => r.memberId).sort()).toEqual(
      ["a", "b"],
    );
  });

  it("an all-zero week has no winner", () => {
    const ranked = rankMembers([
      { memberId: "a", score: 0 },
      { memberId: "b", score: 0 },
    ]);
    expect(ranked.every((r) => !r.winner)).toBe(true);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });
});
