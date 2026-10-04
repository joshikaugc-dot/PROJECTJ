import { describe, expect, it } from "vitest";
import { gmailContext } from "@contextos/shared/fixtures";
import { BUILT_IN_VERTICALS, createDefaultRegistry, salesVertical } from "../index";
import { defineVertical } from "./define";
import { getRecommendedActions } from "./recommendations";
import { VerticalRegistry, VerticalValidationError } from "./registry";

describe("VerticalRegistry", () => {
  it("registers every built-in vertical", () => {
    const registry = createDefaultRegistry();
    expect(registry.list()).toHaveLength(BUILT_IN_VERTICALS.length);
    expect(registry.available().map((v) => v.id)).toEqual(["marketing"]);
  });

  it("rejects inconsistent verticals", () => {
    const broken = defineVertical({
      id: "broken",
      name: "Broken",
      description: "",
      version: "1",
      status: "available",
      systemPrompt: "",
      skills: [],
      workflows: [],
      recommendedActions: [{ id: "a", label: "A", skillId: "missing", priority: 1 }],
    });
    expect(() => new VerticalRegistry().register(broken)).toThrow(VerticalValidationError);
  });

  it("resolves the active vertical from what the user enabled", () => {
    const registry = createDefaultRegistry();
    expect(registry.resolveActive(["marketing"], "sales", null)?.id).toBe("marketing");
    expect(registry.resolveActive([], null, "marketing")).toBeUndefined();
  });

  it("activates a new vertical without any platform change", () => {
    // This is the whole "How to add the Sales vertical" tutorial in one test.
    const registry = new VerticalRegistry().register({ ...salesVertical, status: "available" });
    const sales = registry.resolveActive(["sales"], null, "sales")!;
    expect(sales.name).toBe("Sales");
    const actions = getRecommendedActions({ vertical: sales, appContext: gmailContext() });
    expect(actions.map((a) => a.action.label)).toContain("Write Cold Outreach");
  });
});
