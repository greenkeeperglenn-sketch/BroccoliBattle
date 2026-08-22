/**
 * Applies SQL migrations from db/migrations to the configured database.
 *
 *   pnpm db:migrate
 *
 * With DATABASE_URL set this migrates the real Postgres database; without it
 * it migrates the local PGlite database (which also happens automatically on
 * app start, so this is mostly useful for Neon).
 */
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  const folder = path.resolve(process.cwd(), "db/migrations");

  if (url && /^postgres(ql)?:/.test(url)) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 1 });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: folder });
    await pool.end();
    console.log("✅ Postgres migrations applied.");
  } else {
    const { getDb } = await import("../lib/db/client");
    await getDb(); // PGlite migrates on connect.
    console.log("✅ Local PGlite database migrated.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
