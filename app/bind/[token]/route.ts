import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { bindMemberInvite } from "@/lib/auth/sessions";
import { MEMBER_COOKIE, cookieOptions } from "@/lib/auth/tokens";

/**
 * Member invite binding: /bind/{token}. Validates the invite, creates a
 * device session, sets the HTTP-only cookie and redirects to the app so the
 * secret disappears from the visible URL.
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
  return response;
}
