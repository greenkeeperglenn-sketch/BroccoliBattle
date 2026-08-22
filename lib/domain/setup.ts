import type { Db } from "@/lib/db/client";
import { households, members } from "@/lib/db/schema";
import { ensureGlobalSeeds, seedAliases, seedPrizes } from "@/lib/db/seeds";
import {
  issueManagementInvite,
  issueMemberInvite,
} from "@/lib/auth/sessions";

/**
 * First-run setup. Only possible while no household exists, and only with
 * the environment BOOTSTRAP_TOKEN — there is no public setup page.
 */

export const AVATAR_STYLES = [
  "broccoli",
  "tomato",
  "blueberry",
  "carrot",
  "custard",
  "plum",
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export async function householdExists(db: Db): Promise<boolean> {
  const rows = await db.select({ id: households.id }).from(households).limit(1);
  return rows.length > 0;
}

export type SetupResult = {
  householdId: string;
  memberLinks: { memberId: string; name: string; token: string }[];
  managementToken: string;
};

export async function createHousehold(
  db: Db,
  args: {
    name: string;
    timezone: string;
    members: { name: string; avatarStyle: AvatarStyle; isManager?: boolean }[];
  },
): Promise<SetupResult> {
  if (await householdExists(db)) {
    throw new Error("A household already exists");
  }

  const [household] = await db
    .insert(households)
    .values({ name: args.name, timezone: args.timezone })
    .returning();

  await ensureGlobalSeeds(db);
  await seedAliases(db);
  await seedPrizes(db, household.id);

  const memberLinks: SetupResult["memberLinks"] = [];
  for (const m of args.members) {
    const [member] = await db
      .insert(members)
      .values({
        householdId: household.id,
        displayName: m.name,
        avatarStyle: m.avatarStyle,
        isManager: m.isManager ?? false,
      })
      .returning();
    const token = await issueMemberInvite(db, member.id);
    memberLinks.push({ memberId: member.id, name: member.displayName, token });
  }

  const managementToken = await issueManagementInvite(db, household.id);

  return { householdId: household.id, memberLinks, managementToken };
}
