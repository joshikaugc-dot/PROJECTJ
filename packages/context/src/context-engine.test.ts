import { describe, expect, it } from "vitest";
import { gmailContext, marketerUser, northstarCompany } from "@contextos/shared/fixtures";
import type { ContextKey } from "@contextos/shared";
import { ContextEngine, contextLabels, selectRelevantContext } from "./context-engine";
import type { ContextRequest } from "./types";

const vertical = { id: "marketing", name: "Marketing" };

function request(overrides: Partial<ContextRequest["task"]> = {}, extra: Partial<ContextRequest> = {}): ContextRequest {
  return {
    organizationId: "org_1",
    userId: "u1",
    vertical,
    appContext: gmailContext(),
    task: { skillId: "rewrite-brand-voice", requiredContext: ["brand.voice", "customers"], ...overrides },
    ...extra,
  };
}

const keys = (blocks: { key: ContextKey }[]) => blocks.map((b) => b.key);

describe("selectRelevantContext", () => {
  it("includes only what the skill needs (no competitors, documents or goals for a rewrite)", () => {
    const ctx = selectRelevantContext({ company: northstarCompany(), user: marketerUser(), request: request() });
    expect(keys(ctx.blocks)).toEqual(expect.arrayContaining(["company.basics", "brand.voice", "customers", "app.metadata", "user.role"]));
    expect(keys(ctx.blocks)).not.toContain("competitors");
    expect(keys(ctx.blocks)).not.toContain("documents");
    expect(keys(ctx.blocks)).not.toContain("goals");
    expect(ctx.promptText).toContain("Confident, Minimal, Evidence-oriented");
  });

  it("adds a competitor only when it is mentioned in the text", () => {
    const ctx = selectRelevantContext({
      company: northstarCompany(),
      user: marketerUser(),
      request: request({ text: "Why is Northstar better than WHOOP?" }),
    });
    const competitors = ctx.blocks.find((b) => b.key === "competitors");
    expect(competitors?.content).toContain("WHOOP");
    expect(competitors?.content).not.toContain("Oura");
    expect(competitors?.reason).toMatch(/mentioned/i);
  });

  it("uses the primary product when required and none is mentioned", () => {
    const ctx = selectRelevantContext({
      company: northstarCompany(),
      user: marketerUser(),
      request: request({ requiredContext: ["products"] }),
    });
    expect(ctx.blocks.find((b) => b.key === "products")?.label).toBe("Product: Northstar Band");
  });

  it("scopes goals to the active vertical", () => {
    const ctx = selectRelevantContext({
      company: northstarCompany(),
      user: marketerUser(),
      request: request({ requiredContext: ["goals"] }),
    });
    const goals = ctx.blocks.find((b) => b.key === "goals")!;
    expect(goals.label).toBe("Marketing Goals");
    expect(goals.content).toContain("awareness");
    expect(goals.content).not.toContain("Series B");
  });

  it("never sends nearby page text unless required or opted in", () => {
    const app = gmailContext({ nearbyText: "Earlier thread: John asked for pricing" });
    const optionalOnly = selectRelevantContext({
      company: northstarCompany(),
      user: marketerUser(),
      request: request({ optionalContext: ["app.nearby"] }, { appContext: app }),
    });
    expect(keys(optionalOnly.blocks)).not.toContain("app.nearby");

    const optedIn = selectRelevantContext({
      company: northstarCompany(),
      user: marketerUser(),
      request: request({ optionalContext: ["app.nearby"] }, { appContext: app, includePageContext: true }),
    });
    expect(optedIn.blocks.find((b) => b.key === "app.nearby")?.label).toBe("Email Thread");
  });

  it("retrieves relevant documents by keyword", () => {
    const ctx = selectRelevantContext({
      company: northstarCompany(),
      user: marketerUser(),
      request: request({ optionalContext: ["campaigns"], text: "Draft the launch email for the waitlist" }),
    });
    expect(ctx.blocks.find((b) => b.key === "campaigns")?.label).toBe("Fall launch campaign");
  });

  it("respects the character budget", () => {
    const company = northstarCompany();
    company.brand!.voiceDescription = "x".repeat(5000);
    const ctx = selectRelevantContext({
      company,
      user: marketerUser(),
      request: request(),
      budget: { maxChars: 1500, maxDocuments: 1 },
    });
    const total = ctx.blocks.reduce((n, b) => n + b.content.length + b.label.length + 8, 0);
    expect(total).toBeLessThanOrEqual(1500);
  });

  it("produces indicator labels led by the vertical", () => {
    const ctx = selectRelevantContext({ company: northstarCompany(), user: marketerUser(), request: request() });
    expect(contextLabels(vertical, ctx).slice(0, 4)).toEqual(["Marketing", "Northstar", "Brand Voice", "Gmail Context"]);
  });
});

describe("ContextEngine", () => {
  it("loads through the store boundary", async () => {
    const engine = new ContextEngine({
      getCompanyContext: async () => northstarCompany(),
      getUserContext: async () => marketerUser(),
    });
    const result = await engine.getRelevantContext(request());
    expect(result.company.company.name).toBe("Northstar");
    expect(result.blocks.length).toBeGreaterThan(2);
  });
});
