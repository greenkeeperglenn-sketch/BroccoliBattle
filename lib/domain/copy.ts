/**
 * Deterministic microcopy pools. Messages are picked by hashing a seed
 * (usually the client event id) so the copy varies between logs but is
 * stable for a given event — no AI involved.
 */

const AFTER_VEG = [
  "Broccoli deployed.",
  "Vegetable secured. The council nods.",
  "Another veg on the pile. Menacing.",
  "Crunch registered. Points awarded.",
  "The vegetables acknowledge your service.",
];

const AFTER_FRUIT = [
  "Fruit acquired. Glory increased.",
  "Sweet, juicy progress.",
  "Fruit logged. The orchard approves.",
  "That fruit never stood a chance.",
  "Vitamin-based violence. Lovely stuff.",
];

const AT_FIVE = [
  "FIVE ACHIEVED! The council approves.",
  "FIVE! The vegetables acknowledge your greatness.",
  "That's five. Absolute professional.",
];

const PAST_FIVE = [
  "Five was apparently not enough.",
  "Showing off now.",
  "The leaderboard trembles.",
  "Beyond five. Legends only.",
];

const TOOK_LEAD = [
  "NEW LEADER. Try to remain humble.",
  "First place seized. No mercy shown.",
  "You're on top. Guard it with your life.",
];

const MOVED_UP = [
  "You just stole {place} place.",
  "Climbing. {place} place is yours now.",
  "Up you go — {place} place.",
];

const NEW_FOOD = [
  "NEW FIGHTER UNLOCKED.",
  "A new challenger enters the battle.",
  "First time for the family. Historic.",
];

const CASH_IN = [
  "Ticket destroyed. Prize legally claimed.",
  "Stamped, torn, done. Enjoy your winnings.",
  "The ticket has been ceremonially devoured.",
];

const EMPTY_TODAY = [
  "Nothing eaten yet. The broccoli is concerned.",
  "Zero so far. The vegetables are waiting.",
  "The day is young. The fruit bowl is watching.",
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(pool: string[], seed: string): string {
  return pool[hashSeed(seed) % pool.length];
}

export const copy = {
  afterLog: (category: "fruit" | "veg", seed: string) =>
    pick(category === "veg" ? AFTER_VEG : AFTER_FRUIT, seed),
  atFive: (seed: string) => pick(AT_FIVE, seed),
  pastFive: (seed: string) => pick(PAST_FIVE, seed),
  tookLead: (seed: string) => pick(TOOK_LEAD, seed),
  movedUp: (place: string, seed: string) =>
    pick(MOVED_UP, seed).replace("{place}", place),
  newFood: (seed: string) => pick(NEW_FOOD, seed),
  cashIn: (seed: string) => pick(CASH_IN, seed),
  emptyToday: (seed: string) => pick(EMPTY_TODAY, seed),
};
