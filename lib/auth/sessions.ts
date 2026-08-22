import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  households,
  managementInvites,
  managementSessions,
  memberInvites,
  members,
  memberSessions,
  type Household,
  type Member,
} from "@/lib/db/schema";
import { generateToken, hashToken } from "./tokens";

/**
 * Session model: each family member has a private invite URL. Opening it
 * binds the device — a random session token is generated, its hash stored,
 * and the plaintext set as an HTTP-only cookie. From then on the device
 * simply *is* that member. Management access works identically but binds to
 * the household instead of a member.
 */

// ─── Member sessions ────────────────────────────────────────────────────────

export async function bindMemberInvite(
  db: Db,
  inviteToken: string,
): Promise<{ sessionToken: string; member: Member } | null> {
  const [row] = await db
    .select({ invite: memberInvites, member: members })
    .from(memberInvites)
    .innerJoin(members, eq(memberInvites.memberId, members.id))
    .where(
      and(
        eq(memberInvites.tokenHash, hashToken(inviteToken)),
        eq(memberInvites.active, true),
        isNull(memberInvites.revokedAt),
        eq(members.active, true),
      ),
    );
  if (!row) return null;

  const sessionToken = generateToken();
  await db.insert(memberSessions).values({
    memberId: row.member.id,
    sessionTokenHash: hashToken(sessionToken),
  });
  return { sessionToken, member: row.member };
}

export type SessionContext = {
  member: Member;
  household: Household;
};

export async function getSessionMember(
  db: Db,
  sessionToken: string | undefined,
): Promise<SessionContext | null> {
  if (!sessionToken) return null;
  const [row] = await db
    .select({
      session: memberSessions,
      member: members,
      household: households,
    })
    .from(memberSessions)
    .innerJoin(members, eq(memberSessions.memberId, members.id))
    .innerJoin(households, eq(members.householdId, households.id))
    .where(
      and(
        eq(memberSessions.sessionTokenHash, hashToken(sessionToken)),
        isNull(memberSessions.revokedAt),
        eq(members.active, true),
      ),
    );
  if (!row) return null;

  // Touch last_seen_at at most hourly to avoid a write on every request.
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (row.session.lastSeenAt.getTime() < hourAgo) {
    await db
      .update(memberSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(memberSessions.id, row.session.id));
  }

  return { member: row.member, household: row.household };
}

/** Create (or rotate) the invite link token for a member. */
export async function issueMemberInvite(
  db: Db,
  memberId: string,
  opts: { revokeExisting?: boolean } = {},
): Promise<string> {
  if (opts.revokeExisting) {
    await db
      .update(memberInvites)
      .set({ active: false, revokedAt: new Date() })
      .where(eq(memberInvites.memberId, memberId));
  }
  const token = generateToken();
  await db.insert(memberInvites).values({
    memberId,
    tokenHash: hashToken(token),
  });
  return token;
}

// ─── Management sessions ────────────────────────────────────────────────────

export async function issueManagementInvite(
  db: Db,
  householdId: string,
  opts: { revokeExisting?: boolean } = {},
): Promise<string> {
  if (opts.revokeExisting) {
    await db
      .update(managementInvites)
      .set({ active: false, revokedAt: new Date() })
      .where(eq(managementInvites.householdId, householdId));
  }
  const token = generateToken();
  await db.insert(managementInvites).values({
    householdId,
    tokenHash: hashToken(token),
  });
  return token;
}

export async function bindManagementInvite(
  db: Db,
  inviteToken: string,
): Promise<{ sessionToken: string; household: Household } | null> {
  const [row] = await db
    .select({ invite: managementInvites, household: households })
    .from(managementInvites)
    .innerJoin(households, eq(managementInvites.householdId, households.id))
    .where(
      and(
        eq(managementInvites.tokenHash, hashToken(inviteToken)),
        eq(managementInvites.active, true),
        isNull(managementInvites.revokedAt),
      ),
    );
  if (!row) return null;

  const sessionToken = generateToken();
  await db.insert(managementSessions).values({
    householdId: row.household.id,
    sessionTokenHash: hashToken(sessionToken),
  });
  return { sessionToken, household: row.household };
}

export async function getManagementHousehold(
  db: Db,
  sessionToken: string | undefined,
): Promise<Household | null> {
  if (!sessionToken) return null;
  const [row] = await db
    .select({ session: managementSessions, household: households })
    .from(managementSessions)
    .innerJoin(
      households,
      eq(managementSessions.householdId, households.id),
    )
    .where(
      and(
        eq(managementSessions.sessionTokenHash, hashToken(sessionToken)),
        isNull(managementSessions.revokedAt),
      ),
    );
  return row?.household ?? null;
}
