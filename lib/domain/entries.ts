import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  foodEntries,
  foods,
  members,
  weeklyBattles,
  type FoodEntry,
} from "@/lib/db/schema";
import type { Ctx } from "./views";
import { localDateOf, weekStartOf } from "./dates";
import { PORTION_UNITS, type PortionSize } from "./scoring";
import {
  computeStandings,
  ensureCurrentWeek,
  getWeekEntries,
} from "./battles";

/**
 * Entry lifecycle. Creation is idempotent on (household, clientEventId) so
 * the offline outbox can retry safely. Entries in already-closed weeks are
 * locked for normal members; management repair tools may override.
 */

export class EntryError extends Error {
  constructor(
    public code:
      | "food_not_found"
      | "not_found"
      | "not_yours"
      | "week_locked"
      | "bad_time",
    message: string,
  ) {
    super(message);
  }
}

export type CreateEntryResult = {
  entry: FoodEntry;
  duplicate: boolean;
  todayTotal: number;
  newDiscovery: boolean;
  rankBefore: number | null;
  rankAfter: number | null;
};

const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

export async function createEntry(
  db: Db,
  ctx: Ctx,
  args: {
    foodId: string;
    portionSize: PortionSize;
    clientEventId: string;
    consumedAt?: Date;
  },
): Promise<CreateEntryResult> {
  const [food] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, args.foodId), eq(foods.active, true)));
  if (!food || (food.householdId && food.householdId !== ctx.household.id)) {
    throw new EntryError("food_not_found", "That food is not on the menu");
  }

  const now = new Date();
  let consumedAt = args.consumedAt ?? now;
  // Offline entries keep their original time, within reason.
  if (consumedAt.getTime() > now.getTime() + MAX_FUTURE_MS) consumedAt = now;
  if (consumedAt.getTime() < now.getTime() - MAX_BACKDATE_MS) {
    throw new EntryError("bad_time", "That entry is too far in the past");
  }

  const consumedLocalDate = localDateOf(consumedAt, ctx.household.timezone);
  const battle = await ensureCurrentWeek(db, ctx.household);

  // Standings before, for "you stole 2nd place" messaging.
  const weekEntriesBefore = await getWeekEntries(
    db,
    ctx.household.id,
    battle.weekStartLocal,
  );
  const activeMembers = await db
    .select()
    .from(members)
    .where(
      and(eq(members.householdId, ctx.household.id), eq(members.active, true)),
    );
  const before = computeStandings(battle, activeMembers, weekEntriesBefore);
  const rankBefore =
    before.find((s) => s.member.id === ctx.member.id)?.rank ?? null;

  const familyHadFood = await db
    .select({ id: foodEntries.id })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.householdId, ctx.household.id),
        eq(foodEntries.foodId, food.id),
        isNull(foodEntries.deletedAt),
      ),
    )
    .limit(1);

  const [inserted] = await db
    .insert(foodEntries)
    .values({
      householdId: ctx.household.id,
      memberId: ctx.member.id,
      foodId: food.id,
      clientEventId: args.clientEventId,
      portionSize: args.portionSize,
      portionUnits: PORTION_UNITS[args.portionSize],
      categorySnapshot: food.category,
      foodNameSnapshot: food.name,
      consumedAt,
      consumedLocalDate,
    })
    .onConflictDoNothing()
    .returning();

  let entry = inserted;
  let duplicate = false;
  if (!entry) {
    duplicate = true;
    const [existing] = await db
      .select()
      .from(foodEntries)
      .where(
        and(
          eq(foodEntries.householdId, ctx.household.id),
          eq(foodEntries.clientEventId, args.clientEventId),
        ),
      );
    if (!existing) throw new EntryError("not_found", "Entry vanished mid-save");
    entry = existing;
  }

  const todayTotal = await memberDayTotal(
    db,
    ctx.member.id,
    localDateOf(now, ctx.household.timezone),
  );

  let rankAfter = rankBefore;
  if (!duplicate && entry.consumedLocalDate >= battle.weekStartLocal) {
    const weekEntriesAfter = await getWeekEntries(
      db,
      ctx.household.id,
      battle.weekStartLocal,
    );
    const after = computeStandings(battle, activeMembers, weekEntriesAfter);
    rankAfter = after.find((s) => s.member.id === ctx.member.id)?.rank ?? null;
  }

  return {
    entry,
    duplicate,
    todayTotal,
    newDiscovery: !duplicate && familyHadFood.length === 0,
    rankBefore,
    rankAfter,
  };
}

export async function memberDayTotal(
  db: Db,
  memberId: string,
  localDate: string,
): Promise<number> {
  const rows = await db
    .select({ units: foodEntries.portionUnits })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.memberId, memberId),
        eq(foodEntries.consumedLocalDate, localDate),
        isNull(foodEntries.deletedAt),
      ),
    );
  return Math.round(rows.reduce((sum, r) => sum + r.units, 0) * 10) / 10;
}

async function assertEditable(
  db: Db,
  ctx: Ctx,
  entry: FoodEntry,
  opts: { management?: boolean },
): Promise<void> {
  if (opts.management) return;
  if (entry.memberId !== ctx.member.id) {
    throw new EntryError("not_yours", "You can only edit your own food");
  }
  // Entries in a closed battle week are locked.
  const weekStart = weekStartOf(entry.consumedLocalDate);
  const [battle] = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.householdId, ctx.household.id),
        eq(weeklyBattles.weekStartLocal, weekStart),
      ),
    );
  if (battle && battle.status === "closed") {
    throw new EntryError("week_locked", "That week's battle has finished");
  }
}

export async function deleteEntry(
  db: Db,
  ctx: Ctx,
  entryId: string,
  opts: { management?: boolean } = {},
): Promise<FoodEntry> {
  const [entry] = await db
    .select()
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.id, entryId),
        eq(foodEntries.householdId, ctx.household.id),
        isNull(foodEntries.deletedAt),
      ),
    );
  if (!entry) throw new EntryError("not_found", "Entry not found");
  await assertEditable(db, ctx, entry, opts);
  const [updated] = await db
    .update(foodEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(foodEntries.id, entry.id))
    .returning();
  return updated;
}

export async function updateEntryPortion(
  db: Db,
  ctx: Ctx,
  entryId: string,
  portionSize: PortionSize,
  opts: { management?: boolean } = {},
): Promise<FoodEntry> {
  const [entry] = await db
    .select()
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.id, entryId),
        eq(foodEntries.householdId, ctx.household.id),
        isNull(foodEntries.deletedAt),
      ),
    );
  if (!entry) throw new EntryError("not_found", "Entry not found");
  await assertEditable(db, ctx, entry, opts);
  const [updated] = await db
    .update(foodEntries)
    .set({
      portionSize,
      portionUnits: PORTION_UNITS[portionSize],
      updatedAt: new Date(),
    })
    .where(eq(foodEntries.id, entry.id))
    .returning();
  return updated;
}
