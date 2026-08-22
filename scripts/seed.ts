/**
 * Seeds the global catalogue (foods, aliases, challenge definitions) into
 * the configured database. Safe to run repeatedly — inserts are idempotent.
 * Household creation happens through the /setup wizard, not here.
 *
 *   pnpm db:seed
 */
import { getDb } from "../lib/db/client";
import { ensureGlobalSeeds, seedAliases } from "../lib/db/seeds";

async function main() {
  const db = await getDb();
  await ensureGlobalSeeds(db);
  await seedAliases(db);
  console.log("✅ Global seeds in place (foods, aliases, challenges).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
