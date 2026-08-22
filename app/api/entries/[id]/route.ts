import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handle, requireMember } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  EntryError,
  deleteEntry,
  memberDayTotal,
  updateEntryPortion,
} from "@/lib/domain/entries";
import { localDateOf } from "@/lib/domain/dates";

const patchSchema = z.object({
  portionSize: z.enum(["small", "fist", "monster"]),
});

const idSchema = z.uuid();

function entryErrorStatus(err: EntryError): number {
  if (err.code === "not_found") return 404;
  if (err.code === "not_yours") return 403;
  return 422;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const ctx = await requireMember();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return apiError("invalid", "Unknown entry", 404);
    }
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid", "That change didn't make sense", 422);
    }
    const db = await getDb();
    try {
      const entry = await updateEntryPortion(db, ctx, id, parsed.data.portionSize);
      const todayTotal = await memberDayTotal(
        db,
        ctx.member.id,
        localDateOf(new Date(), ctx.household.timezone),
      );
      return NextResponse.json({ ok: true, entryId: entry.id, todayTotal });
    } catch (err) {
      if (err instanceof EntryError) {
        return apiError(err.code, err.message, entryErrorStatus(err));
      }
      throw err;
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const ctx = await requireMember();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return apiError("invalid", "Unknown entry", 404);
    }
    const db = await getDb();
    try {
      await deleteEntry(db, ctx, id);
      const todayTotal = await memberDayTotal(
        db,
        ctx.member.id,
        localDateOf(new Date(), ctx.household.timezone),
      );
      return NextResponse.json({ ok: true, todayTotal });
    } catch (err) {
      if (err instanceof EntryError) {
        return apiError(err.code, err.message, entryErrorStatus(err));
      }
      throw err;
    }
  });
}
