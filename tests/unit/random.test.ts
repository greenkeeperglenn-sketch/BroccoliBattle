import { describe, expect, it } from "vitest";
import { pickUniform, pickWeighted, type Rng } from "@/lib/domain/random";

function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("pickUniform", () => {
  it("selects deterministically with an injected rng", () => {
    const items = ["a", "b", "c", "d"];
    expect(pickUniform(items, () => 0)).toBe("a");
    expect(pickUniform(items, () => 0.999)).toBe("d");
    expect(pickUniform(items, () => 0.5)).toBe("c");
  });

  it("gives every item equal probability across the unit interval", () => {
    const items = ["a", "b", "c"];
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const pick = pickUniform(items, seqRng([i / 3000]));
      counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
    expect(counts.get("a")).toBe(1000);
    expect(counts.get("b")).toBe(1000);
    expect(counts.get("c")).toBe(1000);
  });

  it("throws on an empty list", () => {
    expect(() => pickUniform([], () => 0)).toThrow();
  });
});

describe("pickWeighted", () => {
  const prizes = [
    { title: "takeaway", weight: 1 },
    { title: "film", weight: 2 },
    { title: "chocolate", weight: 3 },
  ];

  it("respects weights exactly across the unit interval", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const p = pickWeighted(prizes, (x) => x.weight, seqRng([i / 6000]));
      counts.set(p.title, (counts.get(p.title) ?? 0) + 1);
    }
    expect(counts.get("takeaway")).toBe(1000);
    expect(counts.get("film")).toBe(2000);
    expect(counts.get("chocolate")).toBe(3000);
  });

  it("boundary rolls select the expected prize", () => {
    expect(pickWeighted(prizes, (x) => x.weight, () => 0).title).toBe("takeaway");
    expect(pickWeighted(prizes, (x) => x.weight, () => 0.99).title).toBe("chocolate");
  });

  it("rejects non-positive weights", () => {
    expect(() =>
      pickWeighted([{ w: 0 }], (x) => x.w, () => 0),
    ).toThrow();
    expect(() =>
      pickWeighted([{ w: -1 }], (x) => x.w, () => 0),
    ).toThrow();
  });
});
