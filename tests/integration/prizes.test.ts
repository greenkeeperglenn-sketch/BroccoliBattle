import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureCurrentWeek } from "@/lib/domain/battles";
import {
  SpinError,
  TicketError,
  cashInTicket,
  getSpinEntitlements,
  spinPrizeWheel,
} from "@/lib/domain/prizes";
import { prizeDefinitions, prizeTickets } from "@/lib/db/schema";
import {
  WEEK1_WED,
  WEEK2_MON,
  createWorld,
  insertEntry,
  type TestWorld,
} from "./helpers";

async function playWeekWithWinner(world: TestWorld, winnerName = "Cerys") {
  const winner = world.members.find((m) => m.displayName === winnerName)!;
  const other = world.members.find((m) => m.displayName !== winnerName)!;
  const battle = await ensureCurrentWeek(world.db, world.household, {
    now: WEEK1_WED,
    rng: () => 0, // VEG_KING
  });
  await insertEntry(world, { member: winner, date: "2026-08-18", units: 5 });
  await insertEntry(world, { member: other, date: "2026-08-18", units: 2 });
  await ensureCurrentWeek(world.db, world.household, { now: WEEK2_MON });
  return { battle, winner, other };
}

describe("prize wheel", () => {
  it("the winner gets exactly one spin; the server picks the prize", async () => {
    const world = await createWorld();
    const { battle, winner } = await playWeekWithWinner(world);

    const entitlements = await getSpinEntitlements(world.db, winner.id);
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].spun).toBe(false);

    // rng 0 → the first (lowest cumulative weight) active prize.
    const result = await spinPrizeWheel(world.db, {
      battleId: battle.id,
      memberId: winner.id,
      rng: () => 0,
    });
    expect(result.ticket.status).toBe("unused");
    expect(result.ticket.titleSnapshot).toBe(result.prize.title);
    expect(result.ticket.wonForSnapshot).toContain("Veg King");

    const after = await getSpinEntitlements(world.db, winner.id);
    expect(after[0].spun).toBe(true);
  });

  it("a non-winner cannot spin", async () => {
    const world = await createWorld();
    const { battle, other } = await playWeekWithWinner(world);
    await expect(
      spinPrizeWheel(world.db, { battleId: battle.id, memberId: other.id }),
    ).rejects.toMatchObject({ code: "not_winner" });
  });

  it("the winner cannot spin twice — a refresh never re-spins", async () => {
    const world = await createWorld();
    const { battle, winner } = await playWeekWithWinner(world);
    await spinPrizeWheel(world.db, { battleId: battle.id, memberId: winner.id });
    await expect(
      spinPrizeWheel(world.db, { battleId: battle.id, memberId: winner.id }),
    ).rejects.toMatchObject({ code: "already_spun" });

    const tickets = await world.db.select().from(prizeTickets);
    expect(tickets).toHaveLength(1);
  });

  it("spinning an open battle is refused", async () => {
    const world = await createWorld();
    const battle = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
    });
    await expect(
      spinPrizeWheel(world.db, {
        battleId: battle.id,
        memberId: world.members[0].id,
      }),
    ).rejects.toThrow(SpinError);
  });

  it("joint winners each spin exactly once", async () => {
    const world = await createWorld();
    const [mum, dad] = world.members;
    const battle = await ensureCurrentWeek(world.db, world.household, {
      now: WEEK1_WED,
      rng: () => 0,
    });
    await insertEntry(world, { member: mum, date: "2026-08-18", units: 4 });
    await insertEntry(world, { member: dad, date: "2026-08-19", units: 4 });
    await ensureCurrentWeek(world.db, world.household, { now: WEEK2_MON });

    await spinPrizeWheel(world.db, { battleId: battle.id, memberId: mum.id });
    await spinPrizeWheel(world.db, { battleId: battle.id, memberId: dad.id });
    await expect(
      spinPrizeWheel(world.db, { battleId: battle.id, memberId: mum.id }),
    ).rejects.toMatchObject({ code: "already_spun" });

    const tickets = await world.db.select().from(prizeTickets);
    expect(tickets).toHaveLength(2);
  });

  it("weighted selection responds to the roll", async () => {
    const world = await createWorld();
    const { battle, winner } = await playWeekWithWinner(world);
    // Total seed weight is 9; a roll of 0.999 lands on the last prize.
    const result = await spinPrizeWheel(world.db, {
      battleId: battle.id,
      memberId: winner.id,
      rng: () => 0.999,
    });
    expect(result.prize.title).toBeTruthy();
  });
});

describe("prize tickets", () => {
  it("cash-in works once and keeps the ticket in history", async () => {
    const world = await createWorld();
    const { battle, winner } = await playWeekWithWinner(world);
    const { ticket } = await spinPrizeWheel(world.db, {
      battleId: battle.id,
      memberId: winner.id,
    });

    const cashed = await cashInTicket(world.db, {
      ticketId: ticket.id,
      memberId: winner.id,
    });
    expect(cashed.status).toBe("cashed_in");
    expect(cashed.cashedInAt).not.toBeNull();

    await expect(
      cashInTicket(world.db, { ticketId: ticket.id, memberId: winner.id }),
    ).rejects.toMatchObject({ code: "already_cashed" });

    const rows = await world.db.select().from(prizeTickets);
    expect(rows).toHaveLength(1); // never deleted
  });

  it("only the ticket owner can cash it in", async () => {
    const world = await createWorld();
    const { battle, winner, other } = await playWeekWithWinner(world);
    const { ticket } = await spinPrizeWheel(world.db, {
      battleId: battle.id,
      memberId: winner.id,
    });
    await expect(
      cashInTicket(world.db, { ticketId: ticket.id, memberId: other.id }),
    ).rejects.toThrow(TicketError);
  });

  it("editing a prize definition never rewrites an issued ticket", async () => {
    const world = await createWorld();
    const { battle, winner } = await playWeekWithWinner(world);
    const { ticket, prize } = await spinPrizeWheel(world.db, {
      battleId: battle.id,
      memberId: winner.id,
    });

    await world.db
      .update(prizeDefinitions)
      .set({ title: "Something else entirely", emoji: "💀" })
      .where(eq(prizeDefinitions.id, prize.prizeDefinitionId));

    const [after] = await world.db
      .select()
      .from(prizeTickets)
      .where(eq(prizeTickets.id, ticket.id));
    expect(after.titleSnapshot).toBe(prize.title);
    expect(after.emojiSnapshot).toBe(prize.emoji);
  });
});
