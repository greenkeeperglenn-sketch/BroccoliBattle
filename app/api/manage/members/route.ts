import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, handle, requireManagement } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { issueMemberInvite } from "@/lib/auth/sessions";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    memberId: z.uuid(),
    name: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("setActive"),
    memberId: z.uuid(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("regenerateInvite"),
    memberId: z.uuid(),
  }),
]);

export async function POST(request: NextRequest) {
  return handle(async () => {
    const household = await requireManagement();
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("invalid", "Bad request", 422);
    const db = await getDb();

    const [member] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.id, parsed.data.memberId),
          eq(members.householdId, household.id),
        ),
      );
    if (!member) return apiError("not_found", "Member not found", 404);

    switch (parsed.data.action) {
      case "rename": {
        await db
          .update(members)
          .set({ displayName: parsed.data.name.trim(), updatedAt: new Date() })
          .where(eq(members.id, member.id));
        return NextResponse.json({ ok: true });
      }
      case "setActive": {
        await db
          .update(members)
          .set({ active: parsed.data.active, updatedAt: new Date() })
          .where(eq(members.id, member.id));
        return NextResponse.json({ ok: true });
      }
      case "regenerateInvite": {
        const token = await issueMemberInvite(db, member.id, {
          revokeExisting: true,
        });
        return NextResponse.json({ ok: true, path: `/bind/${token}` });
      }
    }
  });
}
