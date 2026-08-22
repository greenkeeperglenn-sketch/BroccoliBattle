import { eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db/client";
import {
  foodEntries,
  foods,
  households,
  members,
  type Food,
  type Household,
  type Member,
} from "@/lib/db/schema";
import { createHousehold, type SetupResult } from "@/lib/domain/setup";

export type TestWorld = {
  db: Db;
  household: Household;
  members: Member[];
  setup: SetupResult;
  broccoli: Food;
  apple: Food;
  ctx: (member: Member) => { member: Member; household: Household };
};

export const FAMILY = ["Mum", "Dad", "Cerys", "Evie"] as const;

export async function createWorld(): Promise<TestWorld> {
  const db = await createTestDb();
  const setup = await createHousehold(db, {
    name: "Broccoli Battle",
    timezone: "Europe/London",
    members: FAMILY.map((name, i) => ({
      name,
      avatarStyle: (["broccoli", "tomato", "blueberry", "carrot"] as const)[i],
    })),
  });
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, setup.householdId));
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.householdId, household.id));
  const [broccoli] = await db
    .select()
    .from(foods)
    .where(eq(foods.slug, "broccoli"));
  const [apple] = await db.select().from(foods).where(eq(foods.slug, "apple"));

  return {
    db,
    household,
    members: allMembers,
    setup,
    broccoli,
    apple,
    ctx: (member) => ({ member, household }),
  };
}

let eventCounter = 0;
export function eventId(): string {
  return `test-event-${++eventCounter}`;
}

/** Insert an entry directly (used to seed past weeks beyond the backdate cap). */
export async function insertEntry(
  world: TestWorld,
  args: {
    member: Member;
    food?: Food;
    date: string;
    units?: number;
    size?: "small" | "fist" | "monster";
  },
) {
  const food = args.food ?? world.broccoli;
  await world.db.insert(foodEntries).values({
    householdId: world.household.id,
    memberId: args.member.id,
    foodId: food.id,
    clientEventId: eventId(),
    portionSize: args.size ?? "fist",
    portionUnits: args.units ?? 1,
    categorySnapshot: food.category,
    foodNameSnapshot: food.name,
    consumedAt: new Date(`${args.date}T12:00:00Z`),
    consumedLocalDate: args.date,
  });
}

// Fixed instants for week control (Europe/London, BST in August 2026).
export const WEEK1_WED = new Date("2026-08-19T12:00:00Z"); // week starts 17 Aug
export const WEEK2_MON = new Date("2026-08-24T08:00:00Z"); // week starts 24 Aug
export const WEEK1_START = "2026-08-17";
export const WEEK2_START = "2026-08-24";
