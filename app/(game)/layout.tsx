import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/current";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AutoRefresh } from "@/components/pwa/auto-refresh";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentMember();
  if (!session) redirect("/welcome");

  // Stamped by Vercel at build time; shown in the member menu so anyone can
  // tell at a glance which build their device is running.
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev-build";

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader
        memberName={session.member.displayName}
        avatarStyle={session.member.avatarStyle}
        householdName={session.household.name}
        version={version}
      />
      <main className="mx-auto max-w-md px-4 pt-4">{children}</main>
      <BottomNav />
      <AutoRefresh />
    </div>
  );
}
