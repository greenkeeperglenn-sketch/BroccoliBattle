import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens are 256-bit random values shown once (in invite URLs or set as
 * cookies). Only SHA-256 hashes are stored, so a database leak reveals no
 * usable secrets.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const MEMBER_COOKIE = "bb_session";
export const MANAGE_COOKIE = "bb_manage";

/** ~13 months; the invite link re-binds a device whenever needed. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
