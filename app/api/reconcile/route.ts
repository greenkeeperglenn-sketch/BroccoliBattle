import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { getCurrentMember, getCurrentManagement } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { households } from "@/lib/db/schema";
import { ensureCurrentWeek } from "@/lib/domain/battles";

/**
 * Weekly reconciliation. The app self-heals on every relevant request via
 * ensureCurrentWeek, so this endpoint is a convenience for a Vercel cron
 * (vercel.json schedules it Monday early morning) and for management tools.
 * Authorised via CRON_SECRET bearer, a member session, or management session.
 */
async function reconcile(request: NextRequest) {
  return handle(async () => {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    const isCron = Boolean(cronSecret && auth === `Bearer ${cronSecret}`);
    const session = isCron ? null : await getCurrentMember();
    const management = isCron || session ? null : await getCurrentManagement();

    if (!isCron && !session && !management) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthenticated", message: "Not allowed" } },
        { status: 401 },
      );
    }

    const db = await getDb();
    const all = await db.select().from(households);
    const results = [];
    for (const household of all) {
      const battle = await ensureCurrentWeek(db, household);
      results.push({
        householdId: household.id,
        weekStart: battle.weekStartLocal,
        challenge: battle.challengeSnapshot.name,
      });
    }
    return NextResponse.json({ ok: true, results });
  });
}

export async function GET(request: NextRequest) {
  return reconcile(request);
}

export async function POST(request: NextRequest) {
  return reconcile(request);
}
