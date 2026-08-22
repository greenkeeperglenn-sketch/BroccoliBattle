import { NextResponse } from "next/server";
import { getCurrentMember, getCurrentManagement } from "@/lib/auth/current";
import type { SessionContext } from "@/lib/auth/sessions";
import type { Household } from "@/lib/db/schema";

/** Predictable JSON error shape for every endpoint. */
export function apiError(
  code: string,
  message: string,
  status = 400,
): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Resolve the calling member's session or throw a 401. */
export async function requireMember(): Promise<SessionContext> {
  const session = await getCurrentMember();
  if (!session) {
    throw new HttpError(401, "unauthenticated", "This phone is not bound to a family member");
  }
  return session;
}

/** Resolve the management session or throw a 401. */
export async function requireManagement(): Promise<Household> {
  const household = await getCurrentManagement();
  if (!household) {
    throw new HttpError(401, "unauthenticated", "Management access required");
  }
  return household;
}

/** Wraps a route handler body, converting HttpError into the error shape. */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return apiError(err.code, err.message, err.status);
    }
    console.error(err);
    return apiError("internal", "Something went wrong at Battle HQ", 500);
  }
}
