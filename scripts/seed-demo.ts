/**
 * Builds a local demo/E2E database with a full game in progress:
 * — household "Broccoli Battle" with Mum, Dad, Cerys and Evie,
 * — LAST week: a closed Veg King battle that Cerys won (spin pending),
 * — THIS week: live entries for everyone.
 *
 * Intended for the PGlite fallback only. Wipes the target directory first.
 *
 *   DATABASE_URL=pglite://.data/demo pnpm tsx scripts/seed-demo.ts
 */
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

const DB_URL = process.env.DATABASE_URL ?? "pglite://.data/demo";
if (!DB_URL.startsWith("pglite://")) {
  console.error("seed-demo only runs against a local PGlite database");
  process.exit(1);
}
process.env.DATABASE_URL = DB_URL;
rmSync(path.resolve(process.cwd(), DB_URL.replace("pglite://", "")), {
  recursive: true,
  force: true,
});

async function main() {
  const { getDb } = await import("../lib/db/client");
  const { createHousehold } = await import("../lib/domain/setup");
  const { ensureCurrentWeek } = await import("../lib/domain/battles");
  const { SEED_CHALLENGES } = await import("../lib/db/seeds");
  const schema = await import("../lib/db/schema");
  const dates = await import("../lib/domain/dates");

  const db = await getDb();
  const setup = await createHousehold(db, {
    name: "Broccoli Battle",
    timezone: "Europe/London",
    members: [
      { name: "Mum", avatarStyle: "tomato" },
      { name: "Dad", avatarStyle: "broccoli" },
      { name: "Cerys", avatarStyle: "blueberry" },
      { name: "Evie", avatarStyle: "carrot" },
    ],
  });

  const [household] = await db
    .select()
    .from(schema.households)
    .where(eq(schema.households.id, setup.householdId));
  const members = await db.select().from(schema.members);
  const foods = await db.select().from(schema.foods);
  const foodBySlug = new Map(foods.map((f) => [f.slug, f]));

  const byName = (name: string) =>
    members.find((m) => m.displayName === name)!;

  const today = dates.localDateOf(new Date(), "Europe/London");
  const thisWeekStart = dates.weekStartOf(today);
  const lastWeekStart = dates.addDays(thisWeekStart, -7);

  // Last week's battle: force Veg King so the story is deterministic.
  const vegKing = SEED_CHALLENGES[0];
  const [vegKingRow] = await db
    .select()
    .from(schema.challengeDefinitions)
    .where(eq(schema.challengeDefinitions.code, vegKing.code));
  const vegKingSnapshot = {
    code: vegKing.code,
    name: vegKing.name,
    description: vegKing.description,
    emoji: vegKing.emoji,
    metric: vegKing.metric,
  };
  await db.insert(schema.weeklyBattles).values({
    householdId: household.id,
    weekStartLocal: lastWeekStart,
    weekEndLocal: dates.weekEndOf(lastWeekStart),
    challengeDefinitionId: vegKingRow.id,
    challengeSnapshot: vegKingSnapshot,
  });
  // This week is also Veg King, so demo standings and E2E are deterministic.
  await db.insert(schema.weeklyBattles).values({
    householdId: household.id,
    weekStartLocal: thisWeekStart,
    weekEndLocal: dates.weekEndOf(thisWeekStart),
    challengeDefinitionId: vegKingRow.id,
    challengeSnapshot: vegKingSnapshot,
  });

  let counter = 0;
  const log = async (
    memberName: string,
    slug: string,
    date: string,
    size: "small" | "fist" | "monster" = "fist",
  ) => {
    const food = foodBySlug.get(slug);
    if (!food) throw new Error(`No seed food: ${slug}`);
    const units = size === "small" ? 0.5 : size === "monster" ? 1.5 : 1;
    await db.insert(schema.foodEntries).values({
      householdId: household.id,
      memberId: byName(memberName).id,
      foodId: food.id,
      clientEventId: `demo-${++counter}`,
      portionSize: size,
      portionUnits: units,
      categorySnapshot: food.category,
      foodNameSnapshot: food.name,
      consumedAt: new Date(`${date}T12:00:00Z`),
      consumedLocalDate: date,
    });
  };

  // Last week: Cerys dominates Veg King.
  const lw = (n: number) => dates.addDays(lastWeekStart, n);
  for (let day = 0; day < 7; day++) {
    await log("Cerys", "broccoli", lw(day));
    await log("Cerys", "carrot", lw(day));
    if (day % 2 === 0) await log("Cerys", "peas", lw(day), "monster");
    await log("Dad", "sweetcorn", lw(day));
    if (day < 4) await log("Dad", "pepper", lw(day));
    await log("Mum", "apple", lw(day));
    if (day % 2 === 1) await log("Mum", "spinach", lw(day));
    if (day % 3 === 0) await log("Evie", "banana", lw(day), "small");
    if (day % 3 === 1) await log("Evie", "cucumber", lw(day));
  }

  // This week: a live battle in progress.
  const daysSoFar = dates.dayIndexOf(today);
  const tw = (n: number) => dates.addDays(thisWeekStart, n);
  for (let day = 0; day <= daysSoFar; day++) {
    await log("Mum", "broccoli", tw(day));
    await log("Mum", "strawberry", tw(day));
    await log("Dad", "carrot", tw(day), "monster");
    await log("Cerys", "grapes", tw(day), "small");
    await log("Cerys", "tomato", tw(day));
    if (day % 2 === 0) await log("Evie", "banana", tw(day));
  }
  // Give the current member (Dad by default in screenshots) some of today.
  await log("Dad", "peas", today, "small");
  await log("Dad", "apple", today);

  // Reconcile: closes last week (Cerys wins, spin pending), opens this week.
  await ensureCurrentWeek(db, household);

  // Machine-readable links for the E2E suite.
  const linksFile = `${path.resolve(process.cwd(), DB_URL.replace("pglite://", ""))}-links.json`;
  writeFileSync(
    linksFile,
    JSON.stringify(
      {
        members: Object.fromEntries(
          setup.memberLinks.map((l) => [l.name, `/bind/${l.token}`]),
        ),
        manage: `/manage/bind/${setup.managementToken}`,
      },
      null,
      2,
    ),
  );

  console.log("✅ Demo database ready at", DB_URL);
  console.log("\nInvite links:");
  for (const link of setup.memberLinks) {
    console.log(`  ${link.name.padEnd(6)} /bind/${link.token}`);
  }
  console.log(`  Manage /manage/bind/${setup.managementToken}`);
  console.log(`\nLinks also written to ${linksFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
