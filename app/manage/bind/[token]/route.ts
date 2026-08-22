import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { bindManagementInvite } from "@/lib/auth/sessions";
import { MANAGE_COOKIE, cookieOptions } from "@/lib/auth/tokens";

/** Management access binding: /manage/bind/{token}. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = await getDb();
  const bound = await bindManagementInvite(db, token);

  if (!bound) {
    return NextResponse.redirect(new URL("/welcome?invalid=1", request.url));
  }

  const response = NextResponse.redirect(new URL("/manage", request.url));
  response.cookies.set(MANAGE_COOKIE, bound.sessionToken, cookieOptions());
  return response;
}
