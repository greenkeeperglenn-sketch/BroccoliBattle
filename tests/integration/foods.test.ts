import { describe, expect, it } from "vitest";
import { createCustomFood, findExistingFood } from "@/lib/domain/foods";
import { createWorld } from "./helpers";

describe("food catalogue", () => {
  it("finds foods by name, plural, alias and fuzzy match", async () => {
    const world = await createWorld();
    expect((await findExistingFood(world.db, "Broccoli"))?.slug).toBe("broccoli");
    expect((await findExistingFood(world.db, "strawberries"))?.slug).toBe("strawberry");
    expect((await findExistingFood(world.db, "zucchini"))?.slug).toBe("courgette");
    expect((await findExistingFood(world.db, "red pepper"))?.slug).toBe("pepper");
    expect((await findExistingFood(world.db, "brocoli"))?.slug).toBe("broccoli");
    expect(await findExistingFood(world.db, "quinceberry")).toBeNull();
  });

  it("reuses an existing food instead of duplicating", async () => {
    const world = await createWorld();
    const mum = world.members[0];
    const result = await createCustomFood(world.db, {
      name: "Strawberries",
      householdId: world.household.id,
      memberId: mum.id,
    });
    expect(result.outcome).toBe("existing");
    if (result.outcome === "existing") {
      expect(result.food.slug).toBe("strawberry");
    }
  });

  it("creates a recognised custom food immediately usable", async () => {
    const world = await createWorld();
    const mum = world.members[0];
    const result = await createCustomFood(world.db, {
      name: "parsnips",
      householdId: world.household.id,
      memberId: mum.id,
    });
    expect(result.outcome).toBe("created");
    if (result.outcome === "created") {
      expect(result.food.category).toBe("veg");
      expect(result.food.source).toBe("custom");
      expect(result.food.iconStatus).toBe("placeholder");
    }
  });

  it("rejects junk playfully and asks for a category when unsure", async () => {
    const world = await createWorld();
    const mum = world.members[0];
    const junk = await createCustomFood(world.db, {
      name: "Chocolate Hobnob",
      householdId: world.household.id,
      memberId: mum.id,
    });
    expect(junk.outcome).toBe("rejected");

    const unknown = await createCustomFood(world.db, {
      name: "snozzberry",
      householdId: world.household.id,
      memberId: mum.id,
    });
    expect(unknown.outcome).toBe("needs_category");

    const withHint = await createCustomFood(world.db, {
      name: "snozzberry",
      householdId: world.household.id,
      memberId: mum.id,
      categoryHint: "fruit",
    });
    expect(withHint.outcome).toBe("created");
  });
});
