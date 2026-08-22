import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { apiError, handle, requireManagement } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { foodEntries, members, prizeTickets } from "@/lib/db/schema";
import { restoreTicket } from "@/lib/domain/prizes";
import { PORTION_UNITS } from "@/lib/domain/scoring";

/**
 * Management repair tools: undo an accidental ticket cash-in, and fix
 * historical entries (delete or resize) that normal members can no longer
 * touch because the week has closed.
 */
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restoreTicket"), ticketId: z.uuid() }),
  z.object({ action: z.literal("deleteEntry"), entryId: z.uuid() }),
  z.object({
    action: z.literal("resizeEntry"),
    entryId: z.uuid(),
    portionSize: z.enum(["small", "fist", "monster"]),
  }),
]);

export async function POST(request: NextRequest) {
  return handle(async () => {
    const household = await requireManagement();
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("invalid", "Bad request", 422);
    const db = await getDb();

    if (parsed.data.action === "restoreTicket") {
      const [ticket] = await db
        .select()
        .from(prizeTickets)
        .where(
          and(
            eq(prizeTickets.id, parsed.data.ticketId),
            eq(prizeTickets.householdId, household.id),
          ),
        );
      if (!ticket) return apiError("not_found", "Ticket not found", 404);
      await restoreTicket(db, ticket.id);
      return NextResponse.json({ ok: true });
    }

    const [entry] = await db
      .select()
      .from(foodEntries)
      .where(
        and(
          eq(foodEntries.id, parsed.data.entryId),
          eq(foodEntries.householdId, household.id),
          isNull(foodEntries.deletedAt),
        ),
      );
    if (!entry) return apiError("not_found", "Entry not found", 404);

    if (parsed.data.action === "deleteEntry") {
      await db
        .update(foodEntries)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(foodEntries.id, entry.id));
    } else {
      await db
        .update(foodEntries)
        .set({
          portionSize: parsed.data.portionSize,
          portionUnits: PORTION_UNITS[parsed.data.portionSize],
          updatedAt: new Date(),
        })
        .where(eq(foodEntries.id, entry.id));
    }
    return NextResponse.json({ ok: true });
  });
}

/** Recent entries for the repair tool (last 100, including closed weeks). */
export async function GET() {
  return handle(async () => {
    const household = await requireManagement();
    const db = await getDb();
    const { desc } = await import("drizzle-orm");
    const rows = await db
      .select({ entry: foodEntries, member: members })
      .from(foodEntries)
      .innerJoin(members, eq(foodEntries.memberId, members.id))
      .where(
        and(
          eq(foodEntries.householdId, household.id),
          isNull(foodEntries.deletedAt),
        ),
      )
      .orderBy(desc(foodEntries.consumedAt))
      .limit(100);
    return NextResponse.json({
      ok: true,
      entries: rows.map((r) => ({
        id: r.entry.id,
        member: r.member.displayName,
        food: r.entry.foodNameSnapshot,
        portionSize: r.entry.portionSize,
        units: r.entry.portionUnits,
        date: r.entry.consumedLocalDate,
      })),
    });
  });
}
