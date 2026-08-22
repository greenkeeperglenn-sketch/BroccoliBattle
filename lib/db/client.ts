import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "node:path";
import * as schema from "./schema";

/**
 * The app runs against real Postgres (Neon) when DATABASE_URL is set, and
 * falls back to an embedded PGlite database in .data/pglite otherwise, so
 * local development and CI need no external services.
 *
 * Both drivers expose the same Drizzle API surface; we standardise on the
 * node-postgres database type.
 */
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type GlobalWithDb = typeof globalThis & {
  __broccoliDb?: Promise<Db>;
};

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:/.test(url)) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzle(pool, { schema });
  }

  // Embedded fallback. `pglite://memory` gives an in-memory database
  // (used by tests); anything else persists to a local directory.
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { PGlite } = await import("@electric-sql/pglite");

  const target =
    url === "pglite://memory"
      ? undefined
      : path.resolve(
          process.cwd(),
          url?.replace(/^pglite:\/\//, "") || ".data/pglite",
        );

  const pglite = target ? new PGlite(target) : new PGlite();
  const db = drizzle(pglite, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "db/migrations"),
  });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  const g = globalThis as GlobalWithDb;
  if (!g.__broccoliDb) {
    g.__broccoliDb = createDb();
  }
  return g.__broccoliDb;
}

/** Test helper: build a fresh, isolated in-memory database. */
export async function createTestDb(): Promise<Db> {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "db/migrations"),
  });
  return db as unknown as Db;
}
