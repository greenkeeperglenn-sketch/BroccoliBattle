import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getCurrentManagement } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import {
  challengeDefinitions,
  foods,
  members,
  prizeDefinitions,
  prizeTickets,
} from "@/lib/db/schema";
import { isArtworkAvailable } from "@/lib/ai/artwork";
import { hasTextAI } from "@/lib/ai/openai";
import { ManageScreen } from "@/components/manage/manage-screen";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const household = await getCurrentManagement();

  if (!household) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-5xl" aria-hidden="true">🔐</p>
        <h1 className="font-display text-2xl">Management access needed</h1>
        <p className="text-sm font-bold text-ink-soft">
          Settings live behind the management link created during setup. Open
          it on this device to unlock this page. Lost it? It can be printed
          again from the server with the bootstrap tools described in the
          README.
        </p>
        <Link href="/" className="font-display text-blueberry underline">
          Back to the battle
        </Link>
      </main>
    );
  }

  const db = await getDb();
  const [allMembers, prizes, allFoods, challenges, cashed] = [
    await db
      .select()
      .from(members)
      .where(eq(members.householdId, household.id))
      .orderBy(asc(members.createdAt)),
    await db
      .select()
      .from(prizeDefinitions)
      .where(eq(prizeDefinitions.householdId, household.id))
      .orderBy(asc(prizeDefinitions.createdAt)),
    await db.select().from(foods).orderBy(asc(foods.name)),
    await db
      .select()
      .from(challengeDefinitions)
      .orderBy(asc(challengeDefinitions.name)),
    await db
      .select()
      .from(prizeTickets)
      .where(eq(prizeTickets.householdId, household.id))
      .orderBy(desc(prizeTickets.updatedAt))
      .limit(20),
  ];

  const memberNames = new Map(allMembers.map((m) => [m.id, m.displayName]));

  return (
    <ManageScreen
      household={{
        name: household.name,
        timezone: household.timezone,
        weeklyFamilyTarget: household.weeklyFamilyTarget,
      }}
      members={allMembers.map((m) => ({
        id: m.id,
        name: m.displayName,
        avatarStyle: m.avatarStyle,
        active: m.active,
      }))}
      prizes={prizes.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        emoji: p.emoji,
        weight: p.weight,
        active: p.active,
      }))}
      foods={allFoods
        .filter((f) => f.householdId === null || f.householdId === household.id)
        .map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          emoji: f.emoji,
          source: f.source,
          active: f.active,
          iconStatus: f.iconStatus,
        }))}
      challenges={challenges.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        active: c.active,
      }))}
      cashedTickets={cashed
        .filter((t) => t.status === "cashed_in")
        .map((t) => ({
          id: t.id,
          title: t.titleSnapshot,
          emoji: t.emojiSnapshot,
          member: memberNames.get(t.memberId) ?? "?",
        }))}
      artworkAvailable={isArtworkAvailable()}
      textAIAvailable={hasTextAI()}
    />
  );
}
