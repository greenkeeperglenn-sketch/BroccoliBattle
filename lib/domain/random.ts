import { randomInt } from "node:crypto";

/**
 * All authoritative randomness (weekly challenge draw, prize wheel) goes
 * through an injectable Rng so tests can be deterministic while production
 * uses cryptographic randomness on the server.
 */
export type Rng = () => number; // [0, 1)

export const secureRng: Rng = () => randomInt(0, 2 ** 48) / 2 ** 48;

export function pickUniform<T>(items: readonly T[], rng: Rng = secureRng): T {
  if (items.length === 0) throw new Error("Cannot pick from an empty list");
  return items[Math.floor(rng() * items.length)];
}

export function pickWeighted<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rng: Rng = secureRng,
): T {
  const weights = items.map((item) => {
    const w = weightOf(item);
    if (!Number.isFinite(w) || w <= 0) {
      throw new Error("Weights must be positive numbers");
    }
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("Cannot pick from an empty wheel");
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}
