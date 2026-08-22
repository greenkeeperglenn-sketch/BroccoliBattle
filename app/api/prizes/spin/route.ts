import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handle, requireMember } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { SpinError, spinPrizeWheel } from "@/lib/domain/prizes";

const spinSchema = z.object({ battleId: z.uuid() });

/**
 * The authoritative prize spin. The prize is drawn and persisted here,
 * BEFORE the wheel animation plays — the client merely reveals this result.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireMember();
    const body = await request.json().catch(() => null);
    const parsed = spinSchema.safeParse(body);
    if (!parsed.success) return apiError("invalid", "Unknown battle", 422);
    const db = await getDb();

    try {
      const result = await spinPrizeWheel(db, {
        battleId: parsed.data.battleId,
        memberId: ctx.member.id,
      });
      return NextResponse.json({
        ok: true,
        prize: result.prize,
        ticketId: result.ticket.id,
        wheel: result.wheel,
      });
    } catch (err) {
      if (err instanceof SpinError) {
        const status =
          err.code === "not_winner" ? 403 :
          err.code === "not_found" ? 404 : 409;
        return apiError(err.code, err.message, status);
      }
      throw err;
    }
  });
}
