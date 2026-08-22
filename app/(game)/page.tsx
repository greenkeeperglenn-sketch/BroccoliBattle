import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { getDashboard, getLoggerFoods } from "@/lib/domain/views";
import { BattleScreen } from "@/components/battle/battle-screen";

export const dynamic = "force-dynamic";

export default async function BattlePage() {
  const session = (await getCurrentMember())!; // layout guarantees a session
  const db = await getDb();
  const [dashboard, foods] = [
    await getDashboard(db, session),
    await getLoggerFoods(db, session),
  ];

  return <BattleScreen data={dashboard} foods={foods} />;
}
