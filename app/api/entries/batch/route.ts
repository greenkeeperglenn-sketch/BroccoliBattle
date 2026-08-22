import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handle, requireMember } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { EntryError, createEntry } from "@/lib/domain/entries";

const batchSchema = z.object({
  events: z
    .array(
      z.object({
        foodId: z.uuid(),
        portionSize: z.enum(["small", "fist", "monster"]),
        clientEventId: z.string().min(8).max(80),
        consumedAt: z.iso.datetime().optional(),
      }),
    )
    .min(1)
    .max(50),
});

/** Offline outbox sync: apply queued events idempotently, report per-event. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireMember();
    const body = await request.json().catch(() => null);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid", "That batch didn't make sense", 422);
    }
    const db = await getDb();

    const results: {
      clientEventId: string;
      status: "saved" | "duplicate" | "rejected";
    }[] = [];

    for (const event of parsed.data.events) {
      try {
        const result = await createEntry(db, ctx, {
          foodId: event.foodId,
          portionSize: event.portionSize,
          clientEventId: event.clientEventId,
          consumedAt: event.consumedAt ? new Date(event.consumedAt) : undefined,
        });
        results.push({
          clientEventId: event.clientEventId,
          status: result.duplicate ? "duplicate" : "saved",
        });
      } catch (err) {
        if (err instanceof EntryError) {
          // Rejected events (unknown food, too old) are dropped client-side.
          results.push({ clientEventId: event.clientEventId, status: "rejected" });
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({ ok: true, results });
  });
}
