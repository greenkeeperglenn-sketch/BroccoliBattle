import Link from "next/link";
import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { getWallets } from "@/lib/domain/views";
import { TicketCard } from "@/components/prizes/ticket-card";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const session = (await getCurrentMember())!;
  const db = await getDb();
  const data = await getWallets(db, session);

  const you = data.wallets.find((w) => w.isYou);
  const others = data.wallets.filter((w) => !w.isYou);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-center text-2xl tracking-wide">
        🎟️ PRIZE WALLET
      </h1>

      {data.pendingSpins.map((spin) => (
        <Link
          key={spin.battleId}
          href={`/prizes/spin/${spin.battleId}`}
          className="pressable card-sticker animate-bounce-in block bg-custard px-4 py-3 text-center"
        >
          <span className="font-display block text-lg">
            👑 UNCLAIMED SPIN — {spin.battleEmoji} {spin.battleName.toUpperCase()}
          </span>
          <span className="font-display text-sm text-ink-soft">
            SPIN FOR GLORY →
          </span>
        </Link>
      ))}

      {you ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg">
            {you.name.toUpperCase()}&apos;S WALLET
          </h2>
          {you.unused.length === 0 && you.used.length === 0 ? (
            <p className="card-sticker px-4 py-6 text-center text-sm font-bold text-ink-soft">
              No prize tickets yet. Glory awaits.
            </p>
          ) : (
            <>
              {you.unused.length > 0 ? (
                <>
                  <p className="font-display text-xs tracking-widest text-ink-soft">
                    READY TO CASH IN
                  </p>
                  {you.unused.map((t) => (
                    <TicketCard key={t.id} ticket={t} isYou />
                  ))}
                </>
              ) : null}
              {you.used.length > 0 ? (
                <>
                  <p className="font-display pt-1 text-xs tracking-widest text-ink-soft">
                    USED
                  </p>
                  {you.used.map((t) => (
                    <TicketCard key={t.id} ticket={t} isYou />
                  ))}
                </>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {others.map((wallet) => (
        <section key={wallet.memberId} className="flex flex-col gap-3 pt-2">
          <h2 className="font-display flex items-center gap-2 text-lg">
            <Avatar name={wallet.name} style={wallet.avatarStyle} size="sm" />
            {wallet.name.toUpperCase()}&apos;S WALLET
          </h2>
          {wallet.unused.length === 0 && wallet.used.length === 0 ? (
            <p className="text-sm font-bold text-ink-soft">
              Empty. The wheel has not favoured {wallet.name} yet.
            </p>
          ) : (
            [...wallet.unused, ...wallet.used].map((t) => (
              <TicketCard key={t.id} ticket={t} isYou={false} />
            ))
          )}
        </section>
      ))}
    </div>
  );
}
