import { describe, expect, it } from "vitest";
import { levenshtein, sanitiseFoodName, singularise } from "@/lib/domain/foods";
import { classifyFoodHeuristic } from "@/lib/ai/classify";
import { normaliseAlias, slugify } from "@/lib/db/seeds";

describe("name normalisation", () => {
  it("slugify", () => {
    expect(slugify("Dragon fruit")).toBe("dragon-fruit");
    expect(slugify("  Brussels  Sprouts! ")).toBe("brussels-sprouts");
  });
  it("normaliseAlias", () => {
    expect(normaliseAlias("  Red PEPPER!! ")).toBe("red pepper");
  });
  it("singularise", () => {
    expect(singularise("strawberries")).toBe("strawberry");
    expect(singularise("carrots")).toBe("carrot");
    expect(singularise("tomatoes")).toBe("tomato");
    expect(singularise("cress")).toBe("cress");
  });
  it("sanitiseFoodName strips markup and clamps length", () => {
    expect(sanitiseFoodName("<script>mango</script>")).toBe("scriptmango/script");
    expect(sanitiseFoodName("a".repeat(100)).length).toBe(40);
  });
});

describe("levenshtein", () => {
  it("measures edit distance", () => {
    expect(levenshtein("brocoli", "broccoli")).toBe(1);
    expect(levenshtein("carrot", "carrot")).toBe(0);
    expect(levenshtein("kale", "pear")).toBeGreaterThan(1);
  });
});

describe("heuristic classification", () => {
  it("rejects obvious junk with a playful reason", () => {
    const result = classifyFoodHeuristic("Chocolate Hobnob");
    expect(result.qualifies).toBe(false);
    expect(result.needsCategory).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("recognises known produce with a category", () => {
    const result = classifyFoodHeuristic("parsnips");
    expect(result.qualifies).toBe(true);
    expect(result.category).toBe("veg");
    expect(result.canonicalName.toLowerCase()).toContain("parsnip");
  });

  it("asks for a category when unsure", () => {
    const result = classifyFoodHeuristic("jackfruit");
    expect(result.qualifies).toBe(false);
    expect(result.needsCategory).toBe(true);
  });

  it("accepts the member's category hint for unknown produce", () => {
    const result = classifyFoodHeuristic("jackfruit", "fruit");
    expect(result.qualifies).toBe(true);
    expect(result.category).toBe("fruit");
  });
});
