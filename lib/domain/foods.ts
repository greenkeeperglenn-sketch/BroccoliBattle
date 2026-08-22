import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { foodAliases, foods, type Food } from "@/lib/db/schema";
import { normaliseAlias, slugify } from "@/lib/db/seeds";
import { classifyFood, type FoodClassification } from "@/lib/ai/classify";

/**
 * Food catalogue rules: normalise names, dodge duplicates via slugs, aliases
 * and fuzzy matching, and classify new entries (AI-assisted when available,
 * heuristic otherwise). Creating a food must always work without AI.
 */

export { normaliseAlias, slugify };

/** Strip a trailing plural for matching ("carrots" → "carrot"). */
export function singularise(normalised: string): string {
  if (normalised.endsWith("ies") && normalised.length > 4) {
    return `${normalised.slice(0, -3)}y`;
  }
  if (
    normalised.endsWith("es") &&
    (normalised.endsWith("oes") || normalised.endsWith("shes") || normalised.endsWith("ches"))
  ) {
    return normalised.slice(0, -2);
  }
  if (normalised.endsWith("s") && !normalised.endsWith("ss")) {
    return normalised.slice(0, -1);
  }
  return normalised;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Find an existing food matching the given name: exact slug, alias, plural
 * variants, then a close fuzzy match against catalogue names.
 */
export async function findExistingFood(
  db: Db,
  name: string,
): Promise<Food | null> {
  const normalised = normaliseAlias(name);
  if (!normalised) return null;
  const single = singularise(normalised);

  const allFoods = await db.select().from(foods);
  const bySlug = new Map(allFoods.map((f) => [f.slug, f]));

  for (const candidate of [normalised, single]) {
    const hit = bySlug.get(slugify(candidate));
    if (hit) return hit;
  }

  const aliasRows = await db.select().from(foodAliases);
  const byAlias = new Map(aliasRows.map((a) => [a.aliasNormalized, a.foodId]));
  for (const candidate of [normalised, single]) {
    const foodId = byAlias.get(candidate);
    if (foodId) return allFoods.find((f) => f.id === foodId) ?? null;
  }

  // Fuzzy: catch obvious typos ("brocoli" → Broccoli).
  let best: { food: Food; distance: number } | null = null;
  for (const f of allFoods) {
    const target = normaliseAlias(f.name);
    const d = Math.min(
      levenshtein(normalised, target),
      levenshtein(single, singularise(target)),
    );
    if (!best || d < best.distance) best = { food: f, distance: d };
  }
  if (best && best.distance <= Math.max(1, Math.floor(normalised.length / 5))) {
    return best.food;
  }
  return null;
}

export type CreateFoodResult =
  | { outcome: "existing"; food: Food }
  | { outcome: "created"; food: Food; classification: FoodClassification }
  | { outcome: "needs_category" }
  | { outcome: "rejected"; reason: string };

const REJECTION_LINES = [
  "Bold attempt. The broccoli council says no.",
  "The vegetables held a vote. It was unanimous. No.",
  "Nice try. That is not a fruit or a vegetable and everybody knows it.",
];

export function sanitiseFoodName(raw: string): string {
  return raw
    .replace(/[<>\\{}[\]`$]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/**
 * Create a custom food from a member's free-text name. Reuses an existing
 * food when one matches, asks the classifier (AI or heuristic) whether it
 * belongs, and rejects non-produce playfully.
 */
export async function createCustomFood(
  db: Db,
  args: {
    name: string;
    householdId: string;
    memberId: string;
    /** Explicit category the member picked when the classifier is unsure. */
    categoryHint?: "fruit" | "veg";
  },
): Promise<CreateFoodResult> {
  const name = sanitiseFoodName(args.name);
  if (name.length < 2) {
    return { outcome: "rejected", reason: "That name is a bit too mysterious." };
  }

  const existing = await findExistingFood(db, name);
  if (existing) return { outcome: "existing", food: existing };

  const classification = await classifyFood(name, args.categoryHint);
  if (!classification.qualifies) {
    if (classification.needsCategory) return { outcome: "needs_category" };
    const line =
      REJECTION_LINES[Math.abs(hashCode(name)) % REJECTION_LINES.length];
    return { outcome: "rejected", reason: classification.reason || line };
  }
  if (!classification.category) return { outcome: "needs_category" };

  const canonical = classification.canonicalName || titleCase(name);
  // The classifier may canonicalise to something we already have.
  const canonicalExisting = await findExistingFood(db, canonical);
  if (canonicalExisting) return { outcome: "existing", food: canonicalExisting };

  const [food] = await db
    .insert(foods)
    .values({
      householdId: args.householdId,
      name: canonical,
      slug: slugify(canonical),
      category: classification.category,
      emoji: classification.emoji ?? (classification.category === "fruit" ? "🍎" : "🥦"),
      personality: classification.personality ?? null,
      source: "custom",
      createdByMemberId: args.memberId,
    })
    .onConflictDoNothing()
    .returning();

  if (!food) {
    // Slug race — someone added it a moment ago.
    const raced = await findExistingFood(db, canonical);
    if (raced) return { outcome: "existing", food: raced };
    return { outcome: "rejected", reason: "That one confused the scorekeeper. Try again." };
  }

  const aliasValues = new Set(
    [normaliseAlias(name), ...classification.aliases.map(normaliseAlias)].filter(
      (a) => a && a !== normaliseAlias(canonical),
    ),
  );
  if (aliasValues.size > 0) {
    await db
      .insert(foodAliases)
      .values([...aliasValues].map((a) => ({ foodId: food.id, aliasNormalized: a })))
      .onConflictDoNothing();
  }

  return { outcome: "created", food, classification };
}

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
