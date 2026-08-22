import type { Db, Tx } from "./client";
import { challengeDefinitions, foods, prizeDefinitions } from "./schema";

/**
 * Seed data: the global food catalogue, the six weekly challenges, and the
 * default prize wheel. `ensureGlobalSeeds` is idempotent (unique indexes on
 * slug/code) and is called during setup and reconciliation.
 */

type SeedFood = {
  name: string;
  emoji: string;
  personality: string;
  aliases?: string[];
};

export const SEED_FRUIT: SeedFood[] = [
  { name: "Apple", emoji: "🍎", personality: "Polished, smug, thinks it invented healthy eating" },
  { name: "Banana", emoji: "🍌", personality: "Pure chaos in a yellow jacket" },
  { name: "Orange", emoji: "🍊", personality: "Loud, round, impossible to ignore" },
  { name: "Satsuma", emoji: "🍊", personality: "Orange's small cousin with twice the attitude" },
  { name: "Pear", emoji: "🍐", personality: "Gentle giant, surprisingly wise" },
  { name: "Grapes", emoji: "🍇", personality: "A gang that always travels together", aliases: ["grape"] },
  { name: "Strawberry", emoji: "🍓", personality: "Tiny but extremely competitive", aliases: ["strawberries"] },
  { name: "Raspberry", emoji: "🍓", personality: "Blows raspberries at everyone", aliases: ["raspberries"] },
  { name: "Blueberry", emoji: "🫐", personality: "Small, round, secretly a genius", aliases: ["blueberries"] },
  { name: "Blackberry", emoji: "🫐", personality: "Moody hedgerow rebel", aliases: ["blackberries"] },
  { name: "Mango", emoji: "🥭", personality: "Tropical superstar, knows it" },
  { name: "Pineapple", emoji: "🍍", personality: "Spiky punk with a golden heart" },
  { name: "Kiwi", emoji: "🥝", personality: "Fuzzy little daredevil" },
  { name: "Watermelon", emoji: "🍉", personality: "The biggest lad at the party" },
  { name: "Melon", emoji: "🍈", personality: "Chilled out, always lounging" },
  { name: "Peach", emoji: "🍑", personality: "Soft exterior, champion interior" },
  { name: "Nectarine", emoji: "🍑", personality: "Peach's smooth-talking sibling" },
  { name: "Plum", emoji: "🍑", personality: "Small, purple, deceptively fast" },
  { name: "Cherries", emoji: "🍒", personality: "Inseparable double act", aliases: ["cherry"] },
  { name: "Pomegranate", emoji: "🍎", personality: "Hundreds of ideas at once" },
  { name: "Passion fruit", emoji: "🥭", personality: "Extremely dramatic about everything" },
  { name: "Dragon fruit", emoji: "🐉", personality: "Claims to breathe fire, does not", aliases: ["pitaya", "dragonfruit"] },
  { name: "Apricot", emoji: "🍑", personality: "Sunny disposition, naps often" },
  { name: "Grapefruit", emoji: "🍊", personality: "Bitter about not being a grape" },
];

export const SEED_VEG: SeedFood[] = [
  { name: "Broccoli", emoji: "🥦", personality: "Absurdly muscular champion of the whole battle" },
  { name: "Carrot", emoji: "🥕", personality: "Overconfident hero, always pointing somewhere", aliases: ["carrots"] },
  { name: "Peas", emoji: "🫛", personality: "Several idiots squeezed into one pod", aliases: ["pea", "garden peas"] },
  { name: "Sweetcorn", emoji: "🌽", personality: "Hundreds of teeth, all smiling", aliases: ["corn", "corn on the cob"] },
  { name: "Cauliflower", emoji: "🥦", personality: "Broccoli's pale cousin who works out in secret" },
  { name: "Spinach", emoji: "🥬", personality: "Quietly the strongest one here" },
  { name: "Kale", emoji: "🥬", personality: "Takes itself far too seriously" },
  { name: "Cabbage", emoji: "🥬", personality: "Wears forty jackets at once" },
  { name: "Green beans", emoji: "🫛", personality: "Long, lean, always sprinting", aliases: ["green bean", "beans"] },
  { name: "Pepper", emoji: "🫑", personality: "Hollow inside, full of enthusiasm", aliases: ["peppers", "bell pepper", "red pepper", "green pepper", "yellow pepper", "capsicum"] },
  { name: "Tomato", emoji: "🍅", personality: "Legally a fruit, spiritually a veg, emotionally unstable", aliases: ["tomatoes", "cherry tomatoes"] },
  { name: "Cucumber", emoji: "🥒", personality: "Coolest character in the entire game" },
  { name: "Courgette", emoji: "🥒", personality: "Cucumber's ambitious understudy", aliases: ["zucchini"] },
  { name: "Aubergine", emoji: "🍆", personality: "Thinks it is much cooler than it really is", aliases: ["eggplant"] },
  { name: "Mushroom", emoji: "🍄", personality: "Suspicious character lurking in the dark", aliases: ["mushrooms"] },
  { name: "Asparagus", emoji: "🌱", personality: "Fancy spear, fancier opinions" },
  { name: "Beetroot", emoji: "🍠", personality: "Blushes permanently, stains everything", aliases: ["beet", "beets"] },
  { name: "Celery", emoji: "🥬", personality: "Mostly crunch, entirely committed" },
  { name: "Lettuce", emoji: "🥬", personality: "Crisp, leafy, surprisingly good at hiding" },
  { name: "Avocado", emoji: "🥑", personality: "Smooth operator with a heart of stone" },
  { name: "Leek", emoji: "🥬", personality: "Tall, dignified, faintly Welsh" },
  { name: "Onion", emoji: "🧅", personality: "Makes everyone cry, feels bad about it", aliases: ["onions", "red onion", "spring onion"] },
  { name: "Brussels sprouts", emoji: "🥬", personality: "Tiny cabbage warriors, misunderstood", aliases: ["sprouts", "brussel sprouts", "brussels sprout"] },
];

export const SEED_CHALLENGES = [
  {
    code: "VEG_KING",
    name: "Veg King",
    description: "Most vegetable portions wins the crown.",
    emoji: "🥦",
    metric: "veg_portions" as const,
  },
  {
    code: "FRUIT_CHAMPION",
    name: "Fruit Champion",
    description: "Most fruit portions takes the title.",
    emoji: "🍓",
    metric: "fruit_portions" as const,
  },
  {
    code: "VARIETY_VICTORY",
    name: "Variety Victory",
    description: "Most different fruit and veg eaten wins.",
    emoji: "🌈",
    metric: "distinct_foods" as const,
  },
  {
    code: "FIVE_A_DAY_CHAMPION",
    name: "Five-a-Day Champion",
    description: "Most days reaching five wins.",
    emoji: "⭐",
    metric: "five_a_day_days" as const,
  },
  {
    code: "PORTION_POWERHOUSE",
    name: "Portion Powerhouse",
    description: "Most total fruit and veg portions wins.",
    emoji: "💥",
    metric: "total_portions" as const,
  },
  {
    code: "STREAK_CHAMPION",
    name: "Streak Champion",
    description: "Longest five-a-day streak this week wins.",
    emoji: "🔥",
    metric: "five_a_day_streak" as const,
  },
];

export const SEED_PRIZES = [
  { title: "Choose the takeaway", emoji: "🍕", weight: 1, description: "You pick where the family orders from. No vetoes." },
  { title: "Pick the family film", emoji: "🎬", weight: 2, description: "Full control of the next family film night." },
  { title: "Choose a chocolate or treat", emoji: "🍫", weight: 3, description: "One treat of your choosing from the shop." },
  { title: "Choose dessert", emoji: "🍨", weight: 2, description: "Tonight's pudding is entirely your decision." },
  { title: "Mystery prize", emoji: "🎁", weight: 1, description: "Nobody knows what this is. Not even us." },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normaliseAlias(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Idempotently insert challenge definitions and the global food catalogue. */
export async function ensureGlobalSeeds(db: Db | Tx): Promise<void> {
  await db
    .insert(challengeDefinitions)
    .values(SEED_CHALLENGES)
    .onConflictDoNothing();

  const allFoods = [
    ...SEED_FRUIT.map((f) => ({ ...f, category: "fruit" as const })),
    ...SEED_VEG.map((f) => ({ ...f, category: "veg" as const })),
  ];
  await db
    .insert(foods)
    .values(
      allFoods.map((f) => ({
        name: f.name,
        slug: slugify(f.name),
        category: f.category,
        emoji: f.emoji,
        personality: f.personality,
        source: "seed" as const,
      })),
    )
    .onConflictDoNothing();

  // Aliases are inserted by the foods domain when needed; seed ones are
  // handled in seedAliases (called from setup) to avoid a per-request cost.
}

/** Insert the seed aliases for the global catalogue (idempotent). */
export async function seedAliases(db: Db | Tx): Promise<void> {
  const { foodAliases, foods: foodsTable } = await import("./schema");
  const rows = await db.select().from(foodsTable);
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const values: { foodId: string; aliasNormalized: string }[] = [];
  for (const f of [...SEED_FRUIT, ...SEED_VEG]) {
    const id = bySlug.get(slugify(f.name));
    if (!id) continue;
    for (const alias of f.aliases ?? []) {
      values.push({ foodId: id, aliasNormalized: normaliseAlias(alias) });
    }
  }
  if (values.length > 0) {
    await db.insert(foodAliases).values(values).onConflictDoNothing();
  }
}

/** Create the default prize wheel for a new household. */
export async function seedPrizes(
  db: Db | Tx,
  householdId: string,
): Promise<void> {
  await db.insert(prizeDefinitions).values(
    SEED_PRIZES.map((p) => ({
      householdId,
      title: p.title,
      description: p.description,
      emoji: p.emoji,
      weight: p.weight,
    })),
  );
}
