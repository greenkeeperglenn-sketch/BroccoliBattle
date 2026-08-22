import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/current";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentMember();
  if (!session) redirect("/welcome");

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader
        memberName={session.member.displayName}
        avatarStyle={session.member.avatarStyle}
        householdName={session.household.name}
      />
      <main className="mx-auto max-w-md px-4 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
