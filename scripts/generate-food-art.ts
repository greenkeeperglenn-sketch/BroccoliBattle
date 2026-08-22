/**
 * One-time (restartable) seed-artwork generator.
 *
 *   pnpm generate:food-art            # generate art for foods without any
 *   pnpm generate:food-art --retry    # also retry previously failed foods
 *   pnpm generate:food-art --limit 5  # cap this run
 *
 * Requires OPENAI_API_KEY and BLOB_READ_WRITE_TOKEN (and DATABASE_URL for a
 * real database). Never runs as part of build or deploy. Generates one image
 * at a time, shows progress, skips foods that already have art, and reports
 * failures at the end — safe to re-run until everything is drawn.
 */
import { eq } from "drizzle-orm";

async function main() {
  const { getDb } = await import("../lib/db/client");
  const { foods } = await import("../lib/db/schema");
  const { generateFoodArtwork, isArtworkAvailable } = await import(
    "../lib/ai/artwork"
  );

  if (!isArtworkAvailable()) {
    console.error(
      "❌ Artwork generation needs OPENAI_API_KEY and BLOB_READ_WRITE_TOKEN.",
    );
    process.exit(1);
  }

  const retry = process.argv.includes("--retry");
  const limitFlag = process.argv.indexOf("--limit");
  const limit =
    limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) || Infinity : Infinity;

  const db = await getDb();
  const all = await db.select().from(foods).where(eq(foods.active, true));
  const todo = all
    .filter((f) =>
      retry
        ? f.iconStatus !== "ready"
        : f.iconStatus === "placeholder",
    )
    .slice(0, limit);

  console.log(
    `🎨 ${todo.length} of ${all.length} foods need artwork${retry ? " (including retries)" : ""}.`,
  );

  const failures: string[] = [];
  for (const [i, food] of todo.entries()) {
    process.stdout.write(
      `[${i + 1}/${todo.length}] ${food.name.padEnd(20)} … `,
    );
    try {
      await generateFoodArtwork(db, food.id, { force: true });
      console.log("✅");
    } catch (err) {
      failures.push(food.name);
      console.log(`❌ ${err instanceof Error ? err.message : err}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n⚠️  Failed: ${failures.join(", ")}`);
    console.log("Re-run with --retry to try them again.");
    process.exit(1);
  }
  console.log("\n🥦 Every fighter has a face. Glorious.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
