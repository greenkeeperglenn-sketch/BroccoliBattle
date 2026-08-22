import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  prizeDefinitions,
  prizeSpins,
  prizeTickets,
  weeklyBattles,
  weeklyMemberResults,
  type PrizeDefinition,
  type PrizeSnapshot,
  type PrizeTicket,
  type WeeklyBattle,
} from "@/lib/db/schema";
import { pickWeighted, secureRng, type Rng } from "./random";

/**
 * Prize rules:
 * — winning the weekly battle earns exactly one spin per winner,
 * — the server draws the prize (weighted) and persists it BEFORE the wheel
 *   animation reveals it — a refresh can never re-spin,
 * — the spin issues a Prize Ticket that snapshots the prize as won, so
 *   later edits to prize definitions never rewrite history.
 */

export class SpinError extends Error {
  constructor(
    public code:
      | "not_winner"
      | "battle_open"
      | "already_spun"
      | "no_prizes"
      | "not_found",
    message: string,
  ) {
    super(message);
  }
}

export type SpinEntitlement = {
  battle: WeeklyBattle;
  spun: boolean;
};

/** Battles this member has won, with whether the spin has been used. */
export async function getSpinEntitlements(
  db: Db,
  memberId: string,
): Promise<SpinEntitlement[]> {
  const wins = await db
    .select({ battle: weeklyBattles, spin: prizeSpins })
    .from(weeklyMemberResults)
    .innerJoin(
      weeklyBattles,
      eq(weeklyMemberResults.weeklyBattleId, weeklyBattles.id),
    )
    .leftJoin(
      prizeSpins,
      and(
        eq(prizeSpins.weeklyBattleId, weeklyBattles.id),
        eq(prizeSpins.memberId, memberId),
      ),
    )
    .where(
      and(
        eq(weeklyMemberResults.memberId, memberId),
        eq(weeklyMemberResults.winner, true),
        eq(weeklyBattles.status, "closed"),
      ),
    )
    .orderBy(desc(weeklyBattles.weekStartLocal));

  return wins.map((w) => ({ battle: w.battle, spun: w.spin !== null }));
}

export type SpinResult = {
  spinId: string;
  ticket: PrizeTicket;
  prize: PrizeSnapshot;
  wheel: { id: string; title: string; emoji: string; weight: number }[];
};

/**
 * Perform the authoritative spin for a battle the member won. Draws the
 * prize server-side, persists the spin and issues the ticket in one
 * transaction. The unique (battle, member) index makes double-spins
 * impossible even under concurrent requests.
 */
export async function spinPrizeWheel(
  db: Db,
  args: { battleId: string; memberId: string; rng?: Rng },
): Promise<SpinResult> {
  const rng = args.rng ?? secureRng;

  return db.transaction(async (tx) => {
    const [battle] = await tx
      .select()
      .from(weeklyBattles)
      .where(eq(weeklyBattles.id, args.battleId));
    if (!battle) throw new SpinError("not_found", "Battle not found");
    if (battle.status !== "closed") {
      throw new SpinError("battle_open", "The battle has not finished yet");
    }

    const [result] = await tx
      .select()
      .from(weeklyMemberResults)
      .where(
        and(
          eq(weeklyMemberResults.weeklyBattleId, battle.id),
          eq(weeklyMemberResults.memberId, args.memberId),
        ),
      );
    if (!result?.winner) {
      throw new SpinError("not_winner", "Only the champion may spin");
    }

    const [existing] = await tx
      .select()
      .from(prizeSpins)
      .where(
        and(
          eq(prizeSpins.weeklyBattleId, battle.id),
          eq(prizeSpins.memberId, args.memberId),
        ),
      );
    if (existing) {
      throw new SpinError("already_spun", "This spin has already been used");
    }

    const activePrizes = await tx
      .select()
      .from(prizeDefinitions)
      .where(
        and(
          eq(prizeDefinitions.householdId, battle.householdId),
          eq(prizeDefinitions.active, true),
        ),
      );
    if (activePrizes.length === 0) {
      throw new SpinError("no_prizes", "The prize wheel is empty");
    }

    const prize = pickWeighted(activePrizes, (p: PrizeDefinition) => p.weight, rng);
    const snapshot: PrizeSnapshot = {
      title: prize.title,
      description: prize.description,
      emoji: prize.emoji,
      prizeDefinitionId: prize.id,
    };

    const [spin] = await tx
      .insert(prizeSpins)
      .values({
        weeklyBattleId: battle.id,
        memberId: args.memberId,
        prizeDefinitionId: prize.id,
        prizeSnapshot: snapshot,
      })
      .returning();

    const [ticket] = await tx
      .insert(prizeTickets)
      .values({
        householdId: battle.householdId,
        memberId: args.memberId,
        weeklyBattleId: battle.id,
        prizeSpinId: spin.id,
        titleSnapshot: prize.title,
        descriptionSnapshot: prize.description,
        emojiSnapshot: prize.emoji,
        wonForSnapshot: `${battle.challengeSnapshot.emoji} ${battle.challengeSnapshot.name}`,
      })
      .returning();

    return {
      spinId: spin.id,
      ticket,
      prize: snapshot,
      wheel: activePrizes.map((p) => ({
        id: p.id,
        title: p.title,
        emoji: p.emoji,
        weight: p.weight,
      })),
    };
  });
}

export class TicketError extends Error {
  constructor(
    public code: "not_found" | "not_yours" | "already_cashed",
    message: string,
  ) {
    super(message);
  }
}

/** Cash in an unused ticket. Idempotence-safe: a second attempt errors. */
export async function cashInTicket(
  db: Db,
  args: { ticketId: string; memberId: string },
): Promise<PrizeTicket> {
  return db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(prizeTickets)
      .where(eq(prizeTickets.id, args.ticketId))
      .for("update");
    if (!ticket) throw new TicketError("not_found", "Ticket not found");
    if (ticket.memberId !== args.memberId) {
      throw new TicketError("not_yours", "That ticket belongs to someone else");
    }
    if (ticket.status !== "unused") {
      throw new TicketError("already_cashed", "Ticket already cashed in");
    }
    const [updated] = await tx
      .update(prizeTickets)
      .set({ status: "cashed_in", cashedInAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(prizeTickets.id, ticket.id), eq(prizeTickets.status, "unused")),
      )
      .returning();
    if (!updated) throw new TicketError("already_cashed", "Ticket already cashed in");
    return updated;
  });
}

/** Management repair: revert an accidental cash-in. */
export async function restoreTicket(
  db: Db,
  ticketId: string,
): Promise<PrizeTicket | null> {
  const [updated] = await db
    .update(prizeTickets)
    .set({ status: "unused", cashedInAt: null, updatedAt: new Date() })
    .where(eq(prizeTickets.id, ticketId))
    .returning();
  return updated ?? null;
}
