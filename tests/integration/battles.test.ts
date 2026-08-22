import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureCurrentWeek } from "@/lib/domain/battles";
import { weeklyBattles, weeklyMemberResults } from "@/lib/db/schema";
import {
  WEEK1_START,
  WEEK1_WED,
  WEEK2_MON,
  WEEK2_START,
  createWorld,
  insertEntry,
} from "./helpers";

describe("weekly battle lifecycle", () => {
  it("creates exactly one battle per week, even when called repeatedly", async () => {
    const world = await createWorld();
    const first = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
    });
    const second = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
    });
    expect(first.id).toBe(second.id);
    expect(first.weekStartLocal).toBe(WEEK1_START);
    expect(first.weekEndLocal).toBe("2026-08-23");

    const all = await world.db.select().from(weeklyBattles);
    expect(all).toHaveLength(1);
  });

  it("selects the challenge with injected deterministic randomness and never re-rolls", async () => {
    const world = await createWorld();
    // rng() = 0 always picks the first active challenge row.
    const battle = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
      rng: () => 0,
    });
    const again = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
      rng: () => 0.99,
    });
    expect(again.challengeSnapshot.code).toBe(battle.challengeSnapshot.code);
  });

  it("closes the old week with a snapshot, winner and report, then opens the new one", async () => {
    const world = await createWorld();
    const [mum, dad, cerys] = world.members;
    // Force a portions-based challenge so the scores below are meaningful.
    const battle = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
      rng: () => 0, // VEG_KING (first seeded challenge)
    });
    expect(battle.challengeSnapshot.code).toBe("VEG_KING");

    await insertEntry(world, { member: cerys, date: "2026-08-18", units: 3 });
    await insertEntry(world, { member: cerys, date: "2026-08-19", units: 2 });
    await insertEntry(world, { member: dad, date: "2026-08-19", units: 4 });
    await insertEntry(world, { member: mum, date: "2026-08-19", units: 1, food: world.apple });

    const next = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK2_MON,
    });
    expect(next.weekStartLocal).toBe(WEEK2_START);

    const [closed] = await world.db
      .select()
      .from(weeklyBattles)
      .where(eq(weeklyBattles.id, battle.id));
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).not.toBeNull();
    expect(closed.report).toContain("Cerys");

    const results = await world.db
      .select()
      .from(weeklyMemberResults)
      .where(eq(weeklyMemberResults.weeklyBattleId, battle.id));
    expect(results).toHaveLength(4);
    const byMember = new Map(results.map((r) => [r.memberId, r]));
    expect(byMember.get(cerys.id)?.score).toBe(5);
    expect(byMember.get(cerys.id)?.winner).toBe(true);
    expect(byMember.get(cerys.id)?.rank).toBe(1);
    expect(byMember.get(dad.id)?.score).toBe(4);
    expect(byMember.get(dad.id)?.winner).toBe(false);
    // Mum's apple is fruit — no veg points under Veg King.
    expect(byMember.get(mum.id)?.score).toBe(0);
    expect(byMember.get(cerys.id)?.resultDetail?.fruitPortions).toBe(0);
    expect(byMember.get(mum.id)?.resultDetail?.fruitPortions).toBe(1);
  });

  it("a genuine tie produces joint champions", async () => {
    const world = await createWorld();
    const [mum, dad] = world.members;
    await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
      rng: () => 0,
    });
    await insertEntry(world, { member: mum, date: "2026-08-18", units: 3 });
    await insertEntry(world, { member: dad, date: "2026-08-19", units: 3 });
    await ensureCurrentWeek(world.db, world.household, { now: WEEK2_MON });

    const results = await world.db.select().from(weeklyMemberResults);
    const winners = results.filter((r) => r.winner);
    expect(winners).toHaveLength(2);
    expect(winners.every((w) => w.rank === 1)).toBe(true);
  });

  it("an all-zero week closes with no champion but still opens the next battle", async () => {
    const world = await createWorld();
    await ensureCurrentWeek(world.db, world.household, { now: WEEK1_WED });
    const next = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK2_MON,
    });
    expect(next.status).toBe("open");
    const results = await world.db.select().from(weeklyMemberResults);
    expect(results).toHaveLength(4);
    expect(results.every((r) => !r.winner)).toBe(true);
  });

  it("closed results are snapshots — later entries cannot change them", async () => {
    const world = await createWorld();
    const [mum] = world.members;
    const battle = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
      rng: () => 0,
    });
    await insertEntry(world, { member: mum, date: "2026-08-19", units: 2 });
    await ensureCurrentWeek(world.db, world.household, { now: WEEK2_MON });

    // A rogue late insert into the old week...
    await insertEntry(world, { member: mum, date: "2026-08-20", units: 5 });
    await ensureCurrentWeek(world.db, world.household, { now: WEEK2_MON });

    const results = await world.db
      .select()
      .from(weeklyMemberResults)
      .where(eq(weeklyMemberResults.weeklyBattleId, battle.id));
    expect(results.find((r) => r.memberId === mum.id)?.score).toBe(2);
  });
});
