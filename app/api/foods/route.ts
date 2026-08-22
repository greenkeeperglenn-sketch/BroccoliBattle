import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { apiError, handle, requireMember } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { createCustomFood } from "@/lib/domain/foods";
import { copy } from "@/lib/domain/copy";
import { generateFoodArtwork, isArtworkAvailable } from "@/lib/ai/artwork";

const createSchema = z.object({
  name: z.string().min(2).max(60),
  categoryHint: z.enum(["fruit", "veg"]).optional(),
});

/** "+ Can't find it?" — add a missing fruit or vegetable. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireMember();
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid", "That name confused the scorekeeper", 422);
    }
    const db = await getDb();

    const result = await createCustomFood(db, {
      name: parsed.data.name,
      householdId: ctx.household.id,
      memberId: ctx.member.id,
      categoryHint: parsed.data.categoryHint,
    });

    if (result.outcome === "rejected") {
      return NextResponse.json({ ok: true, outcome: "rejected", reason: result.reason });
    }
    if (result.outcome === "needs_category") {
      return NextResponse.json({ ok: true, outcome: "needs_category" });
    }

    // Generate character artwork in the background, after the response.
    if (result.outcome === "created" && isArtworkAvailable()) {
      const foodId = result.food.id;
      after(async () => {
        try {
          await generateFoodArtwork(db, foodId);
        } catch {
          // iconStatus is marked failed; management can retry.
        }
      });
    }

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      food: {
        id: result.food.id,
        name: result.food.name,
        category: result.food.category,
        emoji: result.food.emoji,
        iconUrl: result.food.iconStatus === "ready" ? result.food.iconUrl : null,
      },
      message:
        result.outcome === "created"
          ? copy.newFood(result.food.id)
          : `${result.food.name} is already on the menu.`,
    });
  });
}
