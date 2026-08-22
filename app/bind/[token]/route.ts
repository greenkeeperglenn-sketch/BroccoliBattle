import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { bindMemberInvite } from "@/lib/auth/sessions";
import { managementSessions } from "@/lib/db/schema";
import {
  MANAGE_COOKIE,
  MEMBER_COOKIE,
  cookieOptions,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";

/**
 * Member invite binding: /bind/{token}. Validates the invite, creates a
 * device session, sets the HTTP-only cookie and redirects to the app so the
 * secret disappears from the visible URL. A manager's invite also binds a
 * management session — their phone is both player and admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = await getDb();
  const bound = await bindMemberInvite(db, token);

  if (!bound) {
    return NextResponse.redirect(new URL("/welcome?invalid=1", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(MEMBER_COOKIE, bound.sessionToken, cookieOptions());

  if (bound.member.isManager) {
    const manageToken = generateToken();
    await db.insert(managementSessions).values({
      householdId: bound.member.householdId,
      sessionTokenHash: hashToken(manageToken),
    });
    response.cookies.set(MANAGE_COOKIE, manageToken, cookieOptions());
  }

  return response;
}
