import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import {
  prizeDefinitions,
  prizeSpins,
  weeklyBattles,
  weeklyMemberResults,
} from "@/lib/db/schema";
import { formatWeekRange } from "@/lib/domain/dates";
import { PrizeWheel } from "@/components/prizes/prize-wheel";
import { TicketCard } from "@/components/prizes/ticket-card";
import { getBattleResult } from "@/lib/domain/views";

export const dynamic = "force-dynamic";

export default async function SpinPage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = await params;
  const session = (await getCurrentMember())!;
  const db = await getDb();

  const [battle] = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.id, battleId),
        eq(weeklyBattles.householdId, session.household.id),
        eq(weeklyBattles.status, "closed"),
      ),
    );
  if (!battle) notFound();

  const [result] = await db
    .select()
    .from(weeklyMemberResults)
    .where(
      and(
        eq(weeklyMemberResults.weeklyBattleId, battle.id),
        eq(weeklyMemberResults.memberId, session.member.id),
      ),
    );

  if (!result?.winner) {
    return (
      <div className="card-sticker mt-8 px-5 py-6 text-center">
        <p className="text-4xl" aria-hidden="true">🙅</p>
        <h1 className="font-display pt-2 text-xl">Champions only</h1>
        <p className="pt-2 text-sm font-bold text-ink-soft">
          The wheel spins for the winner of {battle.challengeSnapshot.name}.
          There is always next week.
        </p>
        <Link href="/" className="font-display pt-3 block text-blueberry underline">
          Back to the battle
        </Link>
      </div>
    );
  }

  const [existingSpin] = await db
    .select()
    .from(prizeSpins)
    .where(
      and(
        eq(prizeSpins.weeklyBattleId, battle.id),
        eq(prizeSpins.memberId, session.member.id),
      ),
    );

  if (existingSpin) {
    const view = await getBattleResult(db, session, battle.id);
    return (
      <div className="flex flex-col gap-4 pt-4">
        <h1 className="font-display text-center text-2xl">
          Your prize from {battle.challengeSnapshot.emoji}{" "}
          {battle.challengeSnapshot.name}
        </h1>
        {view?.ticket ? <TicketCard ticket={view.ticket} isYou /> : null}
        <Link
          href="/prizes"
          className="pressable card-sticker block bg-broccoli px-4 py-3 text-center font-display text-white"
        >
          OPEN PRIZE WALLET
        </Link>
      </div>
    );
  }

  const activePrizes = await db
    .select()
    .from(prizeDefinitions)
    .where(
      and(
        eq(prizeDefinitions.householdId, session.household.id),
        eq(prizeDefinitions.active, true),
      ),
    );

  if (activePrizes.length === 0) {
    return (
      <div className="card-sticker mt-8 px-5 py-6 text-center">
        <p className="text-4xl" aria-hidden="true">🎡</p>
        <h1 className="font-display pt-2 text-xl">The wheel is empty</h1>
        <p className="pt-2 text-sm font-bold text-ink-soft">
          Someone needs to add prizes in household settings before you can
          claim your winnings. Your spin will wait.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="text-center">
        <p className="font-display text-sm text-ink-soft">
          {battle.challengeSnapshot.emoji}{" "}
          {battle.challengeSnapshot.name.toUpperCase()} CHAMPION ·{" "}
          {formatWeekRange(battle.weekStartLocal)}
        </p>
        <h1 className="font-display text-3xl">CLAIM YOUR GLORY</h1>
      </div>
      <PrizeWheel
        battleId={battle.id}
        segments={activePrizes.map((p) => ({
          id: p.id,
          title: p.title,
          emoji: p.emoji,
          weight: p.weight,
        }))}
      />
    </div>
  );
}
