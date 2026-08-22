import { describe, expect, it } from "vitest";
import {
  createEntry,
  deleteEntry,
  updateEntryPortion,
  EntryError,
} from "@/lib/domain/entries";
import { ensureCurrentWeek } from "@/lib/domain/battles";
import {
  WEEK1_WED,
  WEEK2_MON,
  createWorld,
  eventId,
  insertEntry,
} from "./helpers";

describe("food entries", () => {
  it("persists an entry with snapshots and units", async () => {
    const world = await createWorld();
    const cerys = world.members.find((m) => m.displayName === "Cerys")!;
    const result = await createEntry(world.db, world.ctx(cerys), {
      foodId: world.broccoli.id,
      portionSize: "fist",
      clientEventId: eventId(),
    });
    expect(result.duplicate).toBe(false);
    expect(result.entry.portionUnits).toBe(1);
    expect(result.entry.categorySnapshot).toBe("veg");
    expect(result.entry.foodNameSnapshot).toBe("Broccoli");
    expect(result.todayTotal).toBe(1);
  });

  it("is idempotent on clientEventId — the same event never double-counts", async () => {
    const world = await createWorld();
    const mum = world.members.find((m) => m.displayName === "Mum")!;
    const id = eventId();
    const first = await createEntry(world.db, world.ctx(mum), {
      foodId: world.apple.id,
      portionSize: "monster",
      clientEventId: id,
    });
    const second = await createEntry(world.db, world.ctx(mum), {
      foodId: world.apple.id,
      portionSize: "monster",
      clientEventId: id,
    });
    expect(second.duplicate).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.todayTotal).toBe(1.5);
  });

  it("flags a family-first food as a new discovery exactly once", async () => {
    const world = await createWorld();
    const [mum, dad] = world.members;
    const first = await createEntry(world.db, world.ctx(mum), {
      foodId: world.apple.id,
      portionSize: "fist",
      clientEventId: eventId(),
    });
    expect(first.newDiscovery).toBe(true);
    const second = await createEntry(world.db, world.ctx(dad), {
      foodId: world.apple.id,
      portionSize: "fist",
      clientEventId: eventId(),
    });
    expect(second.newDiscovery).toBe(false);
  });

  it("undo deletes exactly that entry; portion edits re-score", async () => {
    const world = await createWorld();
    const evie = world.members.find((m) => m.displayName === "Evie")!;
    const ctx = world.ctx(evie);
    const a = await createEntry(world.db, ctx, {
      foodId: world.broccoli.id,
      portionSize: "small",
      clientEventId: eventId(),
    });
    const b = await createEntry(world.db, ctx, {
      foodId: world.broccoli.id,
      portionSize: "fist",
      clientEventId: eventId(),
    });
    expect(b.todayTotal).toBe(1.5);

    const updated = await updateEntryPortion(world.db, ctx, a.entry.id, "monster");
    expect(updated.portionUnits).toBe(1.5);

    await deleteEntry(world.db, ctx, b.entry.id);
    const after = await createEntry(world.db, ctx, {
      foodId: world.apple.id,
      portionSize: "small",
      clientEventId: eventId(),
    });
    // 1.5 (edited a) + 0.5 (new) — b is gone.
    expect(after.todayTotal).toBe(2);
  });

  it("members cannot edit someone else's entry", async () => {
    const world = await createWorld();
    const [mum, dad] = world.members;
    const entry = await createEntry(world.db, world.ctx(mum), {
      foodId: world.broccoli.id,
      portionSize: "fist",
      clientEventId: eventId(),
    });
    await expect(
      deleteEntry(world.db, world.ctx(dad), entry.entry.id),
    ).rejects.toThrow(EntryError);
  });

  it("entries in a closed battle week are locked (management may override)", async () => {
    const world = await createWorld();
    const mum = world.members[0];
    await ensureCurrentWeek(world.db, world.household, { now: WEEK1_WED });
    await insertEntry(world, { member: mum, date: "2026-08-19" });

    // A new week arrives; the old battle closes.
    await ensureCurrentWeek(world.db, world.household, { now: WEEK2_MON });

    const { foodEntries } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await world.db
      .select()
      .from(foodEntries)
      .where(eq(foodEntries.consumedLocalDate, "2026-08-19"));

    await expect(
      deleteEntry(world.db, world.ctx(mum), row.id),
    ).rejects.toMatchObject({ code: "week_locked" });

    // Management repair path still works.
    const repaired = await deleteEntry(world.db, world.ctx(mum), row.id, {
      management: true,
    });
    expect(repaired.deletedAt).not.toBeNull();
  });
});
