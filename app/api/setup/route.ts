import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { apiError, handle } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  AVATAR_STYLES,
  createHousehold,
  householdExists,
} from "@/lib/domain/setup";

const setupSchema = z.object({
  bootstrapToken: z.string().min(1),
  name: z.string().min(1).max(60).default("Broccoli Battle"),
  timezone: z.string().min(1).max(60).default("Europe/London"),
  members: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        avatarStyle: z.enum(AVATAR_STYLES),
        isManager: z.boolean().optional(),
      }),
    )
    .length(4),
});

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** One-time household creation, guarded by the environment BOOTSTRAP_TOKEN. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const expected = process.env.BOOTSTRAP_TOKEN;
    if (!expected) {
      return apiError(
        "not_configured",
        "BOOTSTRAP_TOKEN is not set on the server",
        503,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid", "The setup details were incomplete", 422);
    }
    if (!tokenMatches(parsed.data.bootstrapToken, expected)) {
      return apiError("forbidden", "That bootstrap token is wrong", 403);
    }
    if (!isValidTimezone(parsed.data.timezone)) {
      return apiError("invalid", "Unknown timezone", 422);
    }

    const db = await getDb();
    if (await householdExists(db)) {
      return apiError("exists", "A household already exists", 409);
    }

    const result = await createHousehold(db, {
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      members: parsed.data.members,
    });

    return NextResponse.json({
      ok: true,
      memberLinks: result.memberLinks.map((l) => ({
        name: l.name,
        path: `/bind/${l.token}`,
      })),
      managementPath: `/manage/bind/${result.managementToken}`,
    });
  });
}
