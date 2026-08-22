import { and, asc, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import type { Db, Tx } from "@/lib/db/client";
import {
  challengeDefinitions,
  foodEntries,
  households,
  members,
  weeklyBattles,
  weeklyMemberResults,
  type ChallengeSnapshot,
  type Household,
  type Member,
  type WeeklyBattle,
  type WeeklyMemberResult,
} from "@/lib/db/schema";
import { ensureGlobalSeeds } from "@/lib/db/seeds";
import { currentWeekStart, weekDates, weekEndOf, type LocalDate } from "./dates";
import { pickUniform, secureRng, type Rng } from "./random";
import {
  challengeScore,
  memberResultDetail,
  rankMembers,
  type ScoringEntry,
} from "./scoring";
import { buildTemplatedReport } from "./report";

/**
 * Weekly battle lifecycle. The game must self-heal without a cron job:
 * `ensureCurrentWeek` is invoked from every relevant request and
 * — closes any past weeks that are still open (snapshotting final results),
 * — creates the current week's battle with a uniformly random challenge.
 *
 * Duplicate-creation races are resolved by the unique
 * (household, week_start) index, and re-rolls are impossible because the
 * draw is persisted immediately.
 */

export async function getWeekEntries(
  db: Db | Tx,
  householdId: string,
  weekStart: LocalDate,
): Promise<ScoringEntry[]> {
  const rows = await db
    .select({
      memberId: foodEntries.memberId,
      foodId: foodEntries.foodId,
      categorySnapshot: foodEntries.categorySnapshot,
      portionUnits: foodEntries.portionUnits,
      consumedLocalDate: foodEntries.consumedLocalDate,
    })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.householdId, householdId),
        gte(foodEntries.consumedLocalDate, weekStart),
        lte(foodEntries.consumedLocalDate, weekEndOf(weekStart)),
        isNull(foodEntries.deletedAt),
      ),
    );
  return rows;
}

export type Standing = {
  member: Member;
  score: number;
  rank: number;
  winner: boolean;
};

/** Live (or final) standings for a battle, computed from entries. */
export function computeStandings(
  battle: Pick<WeeklyBattle, "challengeSnapshot" | "weekStartLocal">,
  battleMembers: Member[],
  entries: ScoringEntry[],
): Standing[] {
  const dates = weekDates(battle.weekStartLocal);
  const scores = battleMembers.map((m) => ({
    memberId: m.id,
    score: challengeScore(
      battle.challengeSnapshot.metric,
      entries.filter((e) => e.memberId === m.id),
      dates,
    ),
  }));
  const ranked = rankMembers(scores);
  const byId = new Map(battleMembers.map((m) => [m.id, m]));
  return ranked.map((r) => ({
    member: byId.get(r.memberId)!,
    score: r.score,
    rank: r.rank,
    winner: r.winner,
  }));
}

export async function selectRandomChallenge(
  db: Db | Tx,
  rng: Rng = secureRng,
) {
  const active = await db
    .select()
    .from(challengeDefinitions)
    .where(eq(challengeDefinitions.active, true));
  if (active.length === 0) {
    throw new Error("No active challenge definitions to choose from");
  }
  return pickUniform(active, rng);
}

/**
 * Close one battle: snapshot final per-member results, mark it closed and
 * store a templated battle report. Idempotent — a battle already closed by
 * a concurrent request is left untouched.
 */
export async function closeBattle(
  db: Db,
  battleId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [battle] = await tx
      .select()
      .from(weeklyBattles)
      .where(eq(weeklyBattles.id, battleId))
      .for("update");
    if (!battle || battle.status !== "open") return;

    const householdMembers = await tx
      .select()
      .from(members)
      .where(eq(members.householdId, battle.householdId))
      .orderBy(asc(members.createdAt));
    const entries = await getWeekEntries(
      tx,
      battle.householdId,
      battle.weekStartLocal,
    );
    const standings = computeStandings(battle, householdMembers, entries);
    const dates = weekDates(battle.weekStartLocal);

    for (const s of standings) {
      await tx
        .insert(weeklyMemberResults)
        .values({
          weeklyBattleId: battle.id,
          memberId: s.member.id,
          score: s.score,
          rank: s.rank,
          winner: s.winner,
          resultDetail: memberResultDetail(
            entries.filter((e) => e.memberId === s.member.id),
            dates,
          ),
        })
        .onConflictDoNothing();
    }

    const [household] = await tx
      .select()
      .from(households)
      .where(eq(households.id, battle.householdId));

    const report = buildTemplatedReport({
      challenge: battle.challengeSnapshot,
      standings: standings.map((s) => ({
        name: s.member.displayName,
        score: s.score,
        rank: s.rank,
        winner: s.winner,
      })),
      familyTotal: entries.reduce((sum, e) => sum + e.portionUnits, 0),
      familyTarget: household?.weeklyFamilyTarget ?? 140,
      entries,
    });

    await tx
      .update(weeklyBattles)
      .set({ status: "closed", closedAt: new Date(), report })
      .where(eq(weeklyBattles.id, battle.id));
  });
}

/**
 * Reconcile the household's weeks: close finished ones, then make sure the
 * current week has a battle. Returns the current open battle.
 */
export async function ensureCurrentWeek(
  db: Db,
  household: Household,
  opts: { rng?: Rng; now?: Date } = {},
): Promise<WeeklyBattle> {
  const now = opts.now ?? new Date();
  const rng = opts.rng ?? secureRng;
  const weekStart = currentWeekStart(now, household.timezone);

  // 1. Close any past weeks still open.
  const stale = await db
    .select({ id: weeklyBattles.id })
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.householdId, household.id),
        eq(weeklyBattles.status, "open"),
        lt(weeklyBattles.weekStartLocal, weekStart),
      ),
    );
  for (const b of stale) {
    await closeBattle(db, b.id);
  }

  // 2. Ensure this week's battle exists.
  const existing = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.householdId, household.id),
        eq(weeklyBattles.weekStartLocal, weekStart),
      ),
    );
  if (existing.length > 0) return existing[0];

  await ensureGlobalSeeds(db);
  const challenge = await selectRandomChallenge(db, rng);
  const snapshot: ChallengeSnapshot = {
    code: challenge.code,
    name: challenge.name,
    description: challenge.description,
    emoji: challenge.emoji,
    metric: challenge.metric,
  };
  await db
    .insert(weeklyBattles)
    .values({
      householdId: household.id,
      weekStartLocal: weekStart,
      weekEndLocal: weekEndOf(weekStart),
      challengeDefinitionId: challenge.id,
      challengeSnapshot: snapshot,
    })
    .onConflictDoNothing();

  const [battle] = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.householdId, household.id),
        eq(weeklyBattles.weekStartLocal, weekStart),
      ),
    );
  return battle;
}

/** Most recent closed battles, newest first (Hall of Glory). */
export async function getClosedBattles(
  db: Db,
  householdId: string,
  limit = 100,
): Promise<
  { battle: WeeklyBattle; results: (WeeklyMemberResult & { member: Member })[] }[]
> {
  const battles = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.householdId, householdId),
        eq(weeklyBattles.status, "closed"),
      ),
    )
    .orderBy(desc(weeklyBattles.weekStartLocal))
    .limit(limit);

  if (battles.length === 0) return [];

  const results = await db
    .select({
      result: weeklyMemberResults,
      member: members,
    })
    .from(weeklyMemberResults)
    .innerJoin(members, eq(weeklyMemberResults.memberId, members.id))
    .orderBy(asc(weeklyMemberResults.rank));

  return battles.map((battle) => ({
    battle,
    results: results
      .filter((r) => r.result.weeklyBattleId === battle.id)
      .map((r) => ({ ...r.result, member: r.member })),
  }));
}
