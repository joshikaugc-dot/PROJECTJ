import { describe, expect, it } from "vitest";
import { gmailContext } from "@contextos/shared/fixtures";
import { marketingVertical } from "../marketing";
import { getRecommendedActions } from "./recommendations";

const labels = (ctx: Parameters<typeof getRecommendedActions>[0]) => getRecommendedActions(ctx).map((s) => s.action.label);

describe("getRecommendedActions (Marketing)", () => {
  it("recommends the Gmail demo actions in order", () => {
    expect(labels({ vertical: marketingVertical, appContext: gmailContext() }).slice(0, 4)).toEqual([
      "Rewrite in Brand Voice",
      "Improve Conversion",
      "Shorten",
      "Create Follow-Up",
    ]);
  });

  it("replaces generic actions with app-tuned ones", () => {
    const result = labels({ vertical: marketingVertical, appContext: gmailContext() });
    expect(result).toContain("Improve Conversion");
    expect(result).not.toContain("Improve");
  });

  it("offers drafting actions when there is no text", () => {
    const result = labels({
      vertical: marketingVertical,
      appContext: gmailContext({ selectedText: undefined, fieldValue: undefined }),
    });
    expect(result[0]).toBe("Draft Email");
    expect(result).not.toContain("Shorten");
  });

  it("tunes actions for LinkedIn", () => {
    const empty = labels({
      vertical: marketingVertical,
      appContext: gmailContext({ appId: "linkedin", appName: "LinkedIn", selectedText: undefined, surface: "post-composer" }),
    });
    expect(empty[0]).toBe("Write Post");

    const withText = labels({
      vertical: marketingVertical,
      appContext: gmailContext({ appId: "linkedin", appName: "LinkedIn", selectedText: "Recovery matters", surface: "post-composer" }),
    });
    expect(withText).toEqual(expect.arrayContaining(["Improve Hook", "Rewrite in Brand Voice", "Thought-Leadership Version"]));
    expect(withText).not.toContain("Create Follow-Up");
  });

  it("tunes actions for Google Docs", () => {
    const result = labels({
      vertical: marketingVertical,
      appContext: gmailContext({ appId: "google-docs", appName: "Google Docs", surface: "document" }),
    });
    expect(result.slice(0, 2)).toEqual(["Improve Section", "Continue Writing"]);
    expect(result).toEqual(expect.arrayContaining(["Summarize", "Rewrite in Brand Voice"]));
  });

  it("boosts actions that match the user's role", () => {
    const appContext = gmailContext({ appId: "generic", appName: "Web", selectedText: undefined, surface: "form-field" });
    const founder = getRecommendedActions({ vertical: marketingVertical, appContext, userContext: { role: "Founder" } });
    const campaign = founder.find((s) => s.action.id === "campaign-ideas")!;
    expect(campaign.reasons).toContain("matches your role");
  });
});
