import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, handle, requireManagement } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { foods } from "@/lib/db/schema";
import {
  ArtworkError,
  generateFoodArtwork,
  isArtworkAvailable,
} from "@/lib/ai/artwork";

// Image generation takes tens of seconds; allow the function time for it.
export const maxDuration = 60;

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setActive"),
    foodId: z.uuid(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("generateArt"),
    foodId: z.uuid(),
  }),
]);

export async function POST(request: NextRequest) {
  return handle(async () => {
    const household = await requireManagement();
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("invalid", "Bad request", 422);
    const db = await getDb();

    const [food] = await db
      .select()
      .from(foods)
      .where(eq(foods.id, parsed.data.foodId));
    // Global seed foods (null household) are manageable by any household's
    // manager; custom foods only by their own household.
    if (!food || (food.householdId && food.householdId !== household.id)) {
      return apiError("not_found", "Food not found", 404);
    }

    if (parsed.data.action === "setActive") {
      await db
        .update(foods)
        .set({ active: parsed.data.active, updatedAt: new Date() })
        .where(eq(foods.id, food.id));
      return NextResponse.json({ ok: true });
    }

    if (!isArtworkAvailable()) {
      return apiError(
        "not_configured",
        "Artwork needs OPENAI_API_KEY and BLOB_READ_WRITE_TOKEN",
        503,
      );
    }
    try {
      const updated = await generateFoodArtwork(db, food.id, { force: true });
      return NextResponse.json({
        ok: true,
        iconStatus: updated.iconStatus,
        iconUrl: updated.iconUrl,
      });
    } catch (err) {
      if (err instanceof ArtworkError) {
        return apiError("generation_failed", err.message, 502);
      }
      throw err;
    }
  });
}
