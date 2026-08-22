import { z } from "zod";
import { openaiChatJson } from "./openai";

/**
 * Classifies a member-entered food name. Uses the text AI when configured;
 * otherwise falls back to a built-in dictionary + blocklist heuristic, and
 * finally to the member's own fruit/veg choice. Adding a food must always
 * be possible without AI.
 */

export type FoodClassification = {
  qualifies: boolean;
  /** True when we can't tell and the member should pick fruit or veg. */
  needsCategory: boolean;
  canonicalName: string;
  category: "fruit" | "veg" | null;
  aliases: string[];
  confidence: number;
  reason: string | null;
  emoji: string | null;
  personality: string | null;
};

const aiResponseSchema = z.object({
  canonicalName: z.string().min(1).max(40),
  category: z.enum(["fruit", "veg"]),
  qualifies: z.boolean(),
  aliases: z.array(z.string().max(40)).max(8).default([]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
  emoji: z.string().max(8),
  personality: z.string().max(120),
});

// Produce the heuristic recognises beyond the seed catalogue.
const KNOWN_PRODUCE: Record<string, { category: "fruit" | "veg"; emoji: string }> = {
  lemon: { category: "fruit", emoji: "🍋" },
  lime: { category: "fruit", emoji: "🍋" },
  clementine: { category: "fruit", emoji: "🍊" },
  tangerine: { category: "fruit", emoji: "🍊" },
  mandarin: { category: "fruit", emoji: "🍊" },
  lychee: { category: "fruit", emoji: "🍈" },
  papaya: { category: "fruit", emoji: "🥭" },
  guava: { category: "fruit", emoji: "🍈" },
  fig: { category: "fruit", emoji: "🍈" },
  date: { category: "fruit", emoji: "🍈" },
  cranberry: { category: "fruit", emoji: "🍒" },
  gooseberry: { category: "fruit", emoji: "🍈" },
  currant: { category: "fruit", emoji: "🍇" },
  blackcurrant: { category: "fruit", emoji: "🍇" },
  redcurrant: { category: "fruit", emoji: "🍒" },
  persimmon: { category: "fruit", emoji: "🍊" },
  physalis: { category: "fruit", emoji: "🍈" },
  starfruit: { category: "fruit", emoji: "⭐" },
  rhubarb: { category: "fruit", emoji: "🌱" },
  radish: { category: "veg", emoji: "🌱" },
  turnip: { category: "veg", emoji: "🥔" },
  swede: { category: "veg", emoji: "🥔" },
  parsnip: { category: "veg", emoji: "🥕" },
  squash: { category: "veg", emoji: "🎃" },
  "butternut squash": { category: "veg", emoji: "🎃" },
  pumpkin: { category: "veg", emoji: "🎃" },
  "pak choi": { category: "veg", emoji: "🥬" },
  "bok choy": { category: "veg", emoji: "🥬" },
  "broad bean": { category: "veg", emoji: "🫛" },
  edamame: { category: "veg", emoji: "🫛" },
  artichoke: { category: "veg", emoji: "🌱" },
  fennel: { category: "veg", emoji: "🌱" },
  rocket: { category: "veg", emoji: "🥬" },
  watercress: { category: "veg", emoji: "🥬" },
  chard: { category: "veg", emoji: "🥬" },
  "spring greens": { category: "veg", emoji: "🥬" },
  mangetout: { category: "veg", emoji: "🫛" },
  "sugar snap pea": { category: "veg", emoji: "🫛" },
  okra: { category: "veg", emoji: "🌱" },
  "sweet potato": { category: "veg", emoji: "🍠" },
  "runner bean": { category: "veg", emoji: "🫛" },
  "butter bean": { category: "veg", emoji: "🫘" },
  chickpea: { category: "veg", emoji: "🫘" },
  lentil: { category: "veg", emoji: "🫘" },
};

// Obvious non-produce that earns a playful rejection.
const JUNK_WORDS = [
  "chocolate", "biscuit", "hobnob", "cake", "crisp", "chip", "pizza",
  "sweet", "candy", "burger", "sausage", "chicken", "beef", "pork",
  "bacon", "ham", "fish", "bread", "toast", "pasta", "rice", "cheese",
  "yogurt", "yoghurt", "ice cream", "cola", "coke", "lemonade", "beer",
  "wine", "doughnut", "donut", "cookie", "brownie", "haribo", "gummy",
  "toffee", "fudge", "pie", "pastry", "cereal", "nugget", "kebab",
];

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}

function singular(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function classifyFoodHeuristic(
  name: string,
  categoryHint?: "fruit" | "veg",
): FoodClassification {
  const n = normalise(name);
  const sn = singular(n);

  for (const junk of JUNK_WORDS) {
    if (n.includes(junk)) {
      return {
        qualifies: false,
        needsCategory: false,
        canonicalName: name,
        category: null,
        aliases: [],
        confidence: 0.9,
        reason: "Bold attempt. The broccoli council says no.",
        emoji: null,
        personality: null,
      };
    }
  }

  const known = KNOWN_PRODUCE[n] ?? KNOWN_PRODUCE[sn];
  if (known) {
    return {
      qualifies: true,
      needsCategory: false,
      canonicalName: titleCase(sn),
      category: known.category,
      aliases: n === sn ? [] : [n],
      confidence: 0.85,
      reason: null,
      emoji: known.emoji,
      personality: null,
    };
  }

  if (categoryHint) {
    return {
      qualifies: true,
      needsCategory: false,
      canonicalName: titleCase(n),
      category: categoryHint,
      aliases: [],
      confidence: 0.5,
      reason: null,
      emoji: categoryHint === "fruit" ? "🍎" : "🥦",
      personality: null,
    };
  }

  return {
    qualifies: false,
    needsCategory: true,
    canonicalName: titleCase(n),
    category: null,
    aliases: [],
    confidence: 0.3,
    reason: null,
    emoji: null,
    personality: null,
  };
}

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function classifyFood(
  name: string,
  categoryHint?: "fruit" | "veg",
): Promise<FoodClassification> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await openaiChatJson({
        system:
          "You classify foods for a family five-a-day game. Decide whether the entered food is a fruit or vegetable that reasonably counts towards five-a-day (whole fruit and veg qualify; sweets, meat, processed snacks, supplements and drinks do not). Classify by how UK families think about food in meals (tomato = veg), not botany. Return the canonical singular UK English name, common aliases, a single fitting emoji, and a short playful one-line character personality for the food. If it does not qualify, set qualifies=false and give a short playful family-friendly reason.",
        user: `Food name: ${JSON.stringify(name)}${categoryHint ? ` (the family thinks it is a ${categoryHint})` : ""}`,
        schemaName: "food_classification",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            canonicalName: { type: "string" },
            category: { type: "string", enum: ["fruit", "veg"] },
            qualifies: { type: "boolean" },
            aliases: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
            reason: { type: "string" },
            emoji: { type: "string" },
            personality: { type: "string" },
          },
          required: [
            "canonicalName", "category", "qualifies", "aliases",
            "confidence", "reason", "emoji", "personality",
          ],
        },
      });
      const parsed = aiResponseSchema.parse(result);
      return {
        qualifies: parsed.qualifies,
        needsCategory: false,
        canonicalName: parsed.canonicalName,
        category: parsed.qualifies ? parsed.category : null,
        aliases: parsed.aliases,
        confidence: parsed.confidence,
        reason: parsed.qualifies ? null : parsed.reason,
        emoji: parsed.emoji || null,
        personality: parsed.personality || null,
      };
    } catch {
      // AI unavailable or returned junk — fall through to the heuristic.
    }
  }
  return classifyFoodHeuristic(name, categoryHint);
}
