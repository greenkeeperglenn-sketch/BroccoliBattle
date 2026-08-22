import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, handle, requireManagement } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { prizeDefinitions } from "@/lib/db/schema";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().min(1).max(80),
    description: z.string().max(200).optional(),
    emoji: z.string().min(1).max(8),
    weight: z.number().int().min(1).max(100),
  }),
  z.object({
    action: z.literal("update"),
    prizeId: z.uuid(),
    title: z.string().min(1).max(80).optional(),
    description: z.string().max(200).optional(),
    emoji: z.string().min(1).max(8).optional(),
    weight: z.number().int().min(1).max(100).optional(),
    active: z.boolean().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  return handle(async () => {
    const household = await requireManagement();
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("invalid", "Bad request", 422);
    const db = await getDb();

    if (parsed.data.action === "create") {
      const [prize] = await db
        .insert(prizeDefinitions)
        .values({
          householdId: household.id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          emoji: parsed.data.emoji,
          weight: parsed.data.weight,
        })
        .returning();
      return NextResponse.json({ ok: true, prizeId: prize.id });
    }

    const { prizeId, action: _action, ...changes } = parsed.data;
    const [existing] = await db
      .select()
      .from(prizeDefinitions)
      .where(
        and(
          eq(prizeDefinitions.id, prizeId),
          eq(prizeDefinitions.householdId, household.id),
        ),
      );
    if (!existing) return apiError("not_found", "Prize not found", 404);

    await db
      .update(prizeDefinitions)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(prizeDefinitions.id, prizeId));
    return NextResponse.json({ ok: true });
  });
}
