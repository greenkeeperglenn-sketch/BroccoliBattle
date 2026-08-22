import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { householdExists } from "@/lib/domain/setup";
import { SetupWizard } from "@/components/setup/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const db = await getDb();
  const exists = await householdExists(db);

  if (exists) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-5xl" aria-hidden="true">🥦</p>
        <h1 className="font-display text-2xl">The battle already rages</h1>
        <p className="text-sm font-bold text-ink-soft">
          A household exists, so setup is closed. Family members join with
          their invite links; settings live behind the management link.
        </p>
        <Link href="/" className="font-display text-blueberry underline">
          To the battle →
        </Link>
      </main>
    );
  }

  return <SetupWizard />;
}
