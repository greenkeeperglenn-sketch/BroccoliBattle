import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { foods, type Food } from "@/lib/db/schema";
import { imageModelName, openaiGenerateImage } from "./openai";
import { storeArtwork } from "@/lib/blob/store";

/**
 * Food character artwork pipeline (Level 2). Requires OPENAI_API_KEY and
 * BLOB_READ_WRITE_TOKEN; without them foods keep their emoji placeholder
 * and everything else works. Generated images are immutable versioned blobs
 * and are never regenerated unless explicitly requested.
 */

export function isArtworkAvailable(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY && process.env.BLOB_READ_WRITE_TOKEN,
  );
}

export function buildArtworkPrompt(food: Pick<Food, "name" | "personality">): string {
  const personality = food.personality
    ? ` Character concept: ${food.personality}.`
    : "";
  return (
    `Create one original cartoon character representing ${food.name}.` +
    ` It belongs to the Broccoli Battle universe: energetic, cheeky, competitive, playful and slightly ridiculous.${personality}` +
    ` Thick expressive shapes, friendly face, tiny arms and legs, dynamic pose, clear silhouette, strong personality, family-friendly, mobile-game character design.` +
    ` The food itself must remain instantly recognisable.` +
    ` No text, no lettering, no logos, no brand references, no copyrighted characters.` +
    ` Square composition. Character centred. Transparent or clean isolated background.` +
    ` Consistent visual language suitable for a collection of dozens of fruit and vegetable characters.`
  );
}

export class ArtworkError extends Error {}

/**
 * Generate (or regenerate) the character image for one food and persist the
 * result. Marks the food `generating` first so concurrent requests skip it,
 * and `failed` on error so the UI can offer a retry without looping.
 */
export async function generateFoodArtwork(
  db: Db,
  foodId: string,
  opts: { force?: boolean } = {},
): Promise<Food> {
  if (!isArtworkAvailable()) {
    throw new ArtworkError(
      "Artwork generation needs OPENAI_API_KEY and BLOB_READ_WRITE_TOKEN",
    );
  }

  const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
  if (!food) throw new ArtworkError("Food not found");
  if (food.iconStatus === "ready" && !opts.force) return food;
  if (food.iconStatus === "generating" && !opts.force) return food;

  const prompt = buildArtworkPrompt(food);
  const version = food.iconVersion + 1;
  await db
    .update(foods)
    .set({ iconStatus: "generating", updatedAt: new Date() })
    .where(eq(foods.id, food.id));

  try {
    const { bytes, model } = await openaiGenerateImage(prompt);
    const url = await storeArtwork(`${food.slug}-v${version}.png`, bytes);
    const [updated] = await db
      .update(foods)
      .set({
        iconUrl: url,
        iconStatus: "ready",
        iconPrompt: prompt,
        iconProvider: "openai",
        iconModel: model,
        iconVersion: version,
        updatedAt: new Date(),
      })
      .where(eq(foods.id, food.id))
      .returning();
    return updated;
  } catch (err) {
    await db
      .update(foods)
      .set({ iconStatus: "failed", updatedAt: new Date() })
      .where(eq(foods.id, food.id));
    // Redact anything key-shaped: a secret pasted into the model variable
    // must never surface in a UI error message.
    const model = imageModelName().replace(/^sk-.*$/, "[misconfigured: contains a secret]");
    const detail = (err instanceof Error ? err.message : String(err)).replace(
      /sk-[A-Za-z0-9_-]{10,}/g,
      "[redacted]",
    );
    throw new ArtworkError(`Generation failed for ${food.name} (${model}): ${detail}`);
  }
}
