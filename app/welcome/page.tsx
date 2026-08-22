import { getDb } from "@/lib/db/client";
import { householdExists } from "@/lib/domain/setup";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const db = await getDb();
  const exists = await householdExists(db);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="animate-float text-7xl" aria-hidden="true">🥦</div>
      <div>
        <h1 className="font-display text-4xl text-broccoli-dark">
          BROCCOLI BATTLE
        </h1>
        <p className="font-display text-lg text-ink-soft">Fruit. Veg. Glory.</p>
      </div>

      {exists ? (
        <div className="card-sticker px-5 py-4">
          <p className="font-bold">
            This phone doesn&apos;t know who you are yet.
          </p>
          <p className="pt-2 text-sm text-ink-soft">
            Open your personal invite link to join the battle. Ask whoever set
            up Broccoli Battle to send it to you — it binds this phone to your
            name forever (or at least until you get a new phone).
          </p>
        </div>
      ) : (
        <div className="card-sticker px-5 py-4">
          <p className="font-bold">No household exists yet.</p>
          <p className="pt-2 text-sm text-ink-soft">
            The battle has not begun. If you are the person setting this up,
            head to <span className="font-bold">/setup</span> with your
            bootstrap token to create the family.
          </p>
          <a
            href="/setup"
            className="pressable card-sticker mt-4 block bg-broccoli px-4 py-3 font-display text-white"
          >
            Run first-time setup
          </a>
        </div>
      )}
    </main>
  );
}
