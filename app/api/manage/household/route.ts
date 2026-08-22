import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, handle, requireManagement } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { challengeDefinitions, households } from "@/lib/db/schema";

const schema = z.object({
  name: z.string().min(1).max(60).optional(),
  timezone: z.string().min(1).max(60).optional(),
  weeklyFamilyTarget: z.number().min(1).max(1000).optional(),
  challenge: z
    .object({ id: z.uuid(), active: z.boolean() })
    .optional(),
});

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const household = await requireManagement();
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("invalid", "Bad request", 422);
    const db = await getDb();

    const { challenge, ...settings } = parsed.data;
    if (settings.timezone && !isValidTimezone(settings.timezone)) {
      return apiError("invalid", "Unknown timezone", 422);
    }

    if (Object.keys(settings).length > 0) {
      await db
        .update(households)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(households.id, household.id));
    }

    if (challenge) {
      // Keep at least one challenge active — the wheel of fate needs fuel.
      if (!challenge.active) {
        const active = await db
          .select({ id: challengeDefinitions.id })
          .from(challengeDefinitions)
          .where(eq(challengeDefinitions.active, true));
        if (active.length <= 1 && active.some((c) => c.id === challenge.id)) {
          return apiError(
            "last_challenge",
            "At least one challenge must stay active",
            409,
          );
        }
      }
      await db
        .update(challengeDefinitions)
        .set({ active: challenge.active })
        .where(eq(challengeDefinitions.id, challenge.id));
    }

    return NextResponse.json({ ok: true });
  });
}
