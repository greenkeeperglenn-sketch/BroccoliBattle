import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handle, requireMember } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { EntryError, createEntry } from "@/lib/domain/entries";
import { copy } from "@/lib/domain/copy";
import { ordinal } from "@/lib/domain/report";
import { FIVE_A_DAY } from "@/lib/domain/scoring";

const createSchema = z.object({
  foodId: z.uuid(),
  portionSize: z.enum(["small", "fist", "monster"]),
  clientEventId: z.string().min(8).max(80),
  consumedAt: z.iso.datetime().optional(),
});

export type EntryResponse = {
  ok: true;
  entryId: string;
  duplicate: boolean;
  todayTotal: number;
  newDiscovery: boolean;
  messages: {
    log: string;
    five: string | null;
    movement: string | null;
    discovery: string | null;
  };
};

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireMember();
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid", "That entry didn't make sense", 422);
    }
    const db = await getDb();

    try {
      const result = await createEntry(db, ctx, {
        foodId: parsed.data.foodId,
        portionSize: parsed.data.portionSize,
        clientEventId: parsed.data.clientEventId,
        consumedAt: parsed.data.consumedAt
          ? new Date(parsed.data.consumedAt)
          : undefined,
      });

      const seed = parsed.data.clientEventId;
      const before = result.todayTotal - result.entry.portionUnits;
      const crossedFive =
        !result.duplicate && before < FIVE_A_DAY && result.todayTotal >= FIVE_A_DAY;

      let movement: string | null = null;
      if (
        result.rankBefore !== null &&
        result.rankAfter !== null &&
        result.rankAfter < result.rankBefore
      ) {
        movement =
          result.rankAfter === 1
            ? copy.tookLead(seed)
            : copy.movedUp(ordinal(result.rankAfter), seed);
      }

      const response: EntryResponse = {
        ok: true,
        entryId: result.entry.id,
        duplicate: result.duplicate,
        todayTotal: result.todayTotal,
        newDiscovery: result.newDiscovery,
        messages: {
          log: copy.afterLog(result.entry.categorySnapshot, seed),
          five: crossedFive
            ? copy.atFive(seed)
            : !result.duplicate && result.todayTotal > FIVE_A_DAY
              ? copy.pastFive(seed)
              : null,
          movement,
          discovery: result.newDiscovery ? copy.newFood(seed) : null,
        },
      };
      return NextResponse.json(response);
    } catch (err) {
      if (err instanceof EntryError) {
        return apiError(err.code, err.message, 422);
      }
      throw err;
    }
  });
}
