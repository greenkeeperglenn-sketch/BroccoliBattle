import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import {
  getManagementHousehold,
  getSessionMember,
  type SessionContext,
} from "./sessions";
import { MANAGE_COOKIE, MEMBER_COOKIE } from "./tokens";
import type { Household } from "@/lib/db/schema";

/** The member bound to this device, or null. Cached per request. */
export const getCurrentMember = cache(
  async (): Promise<SessionContext | null> => {
    const jar = await cookies();
    const token = jar.get(MEMBER_COOKIE)?.value;
    const db = await getDb();
    return getSessionMember(db, token);
  },
);

/**
 * The household this device may manage, or null. Either an explicit
 * management session (management link) or the member session of a member
 * flagged as manager at setup.
 */
export const getCurrentManagement = cache(
  async (): Promise<Household | null> => {
    const jar = await cookies();
    const token = jar.get(MANAGE_COOKIE)?.value;
    const db = await getDb();
    const viaLink = await getManagementHousehold(db, token);
    if (viaLink) return viaLink;

    const session = await getCurrentMember();
    return session?.member.isManager ? session.household : null;
  },
);
