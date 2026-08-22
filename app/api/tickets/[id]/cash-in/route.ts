import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handle, requireMember } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { TicketError, cashInTicket } from "@/lib/domain/prizes";
import { copy } from "@/lib/domain/copy";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const ctx = await requireMember();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("not_found", "Ticket not found", 404);
    }
    const db = await getDb();
    try {
      const ticket = await cashInTicket(db, {
        ticketId: id,
        memberId: ctx.member.id,
      });
      return NextResponse.json({
        ok: true,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          cashedInAt: ticket.cashedInAt?.toISOString() ?? null,
        },
        message: copy.cashIn(ticket.id),
      });
    } catch (err) {
      if (err instanceof TicketError) {
        const status =
          err.code === "not_found" ? 404 :
          err.code === "not_yours" ? 403 : 409;
        return apiError(err.code, err.message, status);
      }
      throw err;
    }
  });
}
