import { getCurrentMember } from "@/lib/auth/current";
import { getDb } from "@/lib/db/client";
import { getCollection } from "@/lib/domain/views";
import { CollectionGrid } from "@/components/collection/collection-grid";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const session = (await getCurrentMember())!;
  const db = await getDb();
  const cards = await getCollection(db, session);

  return <CollectionGrid cards={cards} />;
}
