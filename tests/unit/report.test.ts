import { describe, expect, it } from "vitest";
import { buildTemplatedReport, joinNames, ordinal } from "@/lib/domain/report";
import { SEED_CHALLENGES } from "@/lib/db/seeds";

const vegKing = {
  code: "VEG_KING",
  name: "Veg King",
  description: SEED_CHALLENGES[0].description,
  emoji: "🥦",
  metric: "veg_portions" as const,
};

describe("templated battle report", () => {
  it("celebrates a single champion and the runner-up", () => {
    const report = buildTemplatedReport({
      challenge: vegKing,
      standings: [
        { name: "Cerys", score: 23, rank: 1, winner: true },
        { name: "Dad", score: 18, rank: 2, winner: false },
        { name: "Mum", score: 12, rank: 3, winner: false },
      ],
      familyTotal: 131,
      familyTarget: 140,
      entries: [],
    });
    expect(report).toContain("Cerys");
    expect(report).toContain("23 vegetable portions");
    expect(report).toContain("Dad");
    expect(report).toContain("131 of 140");
  });

  it("handles joint champions", () => {
    const report = buildTemplatedReport({
      challenge: vegKing,
      standings: [
        { name: "Evie", score: 10, rank: 1, winner: true },
        { name: "Mum", score: 10, rank: 1, winner: true },
      ],
      familyTotal: 20,
      familyTarget: 140,
      entries: [],
    });
    expect(report).toContain("JOINT CHAMPIONS");
    expect(report).toContain("Evie and Mum");
  });

  it("handles a no-score week without a champion", () => {
    const report = buildTemplatedReport({
      challenge: vegKing,
      standings: [
        { name: "Mum", score: 0, rank: 1, winner: false },
        { name: "Dad", score: 0, rank: 1, winner: false },
      ],
      familyTotal: 0,
      familyTarget: 140,
      entries: [],
    });
    expect(report).toContain("no champion");
  });
});

describe("helpers", () => {
  it("ordinal", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
  });
  it("joinNames", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});
