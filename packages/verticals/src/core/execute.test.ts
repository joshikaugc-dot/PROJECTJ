import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { DemoProvider, ModelRouter } from "@contextos/ai";
import { gmailContext, marketerUser } from "@contextos/shared/fixtures";
import type { RelevantContext } from "@contextos/shared";
import type { StepGenerateRequest, WorkflowRuntime } from "@contextos/workflows";
import { marketingVertical } from "../marketing";
import { cleanTextOutput } from "./prompt";
import { executeSkill, SkillInputError } from "./execute";
import type { SkillRunContext } from "./types";

const context: RelevantContext = {
  blocks: [{ key: "brand.voice", label: "Brand Voice", content: "Voice: Confident, Minimal", reason: "On-brand" }],
  promptText: "### Brand Voice\nVoice: Confident, Minimal",
};

const ctx: SkillRunContext = {
  appContext: gmailContext(),
  user: marketerUser(),
  companyName: "Northstar",
  verticalName: "Marketing",
  context,
};

function recordingRuntime(reply: string) {
  const calls: StepGenerateRequest[] = [];
  const runtime: WorkflowRuntime = {
    async generateText(req) {
      calls.push(req);
      return reply;
    },
    async generateObject<T>(req: StepGenerateRequest, schema: z.ZodType<T>) {
      calls.push(req);
      return schema.parse(JSON.parse(reply));
    },
  };
  return { runtime, calls };
}

const skill = (id: string) => marketingVertical.skills.find((s) => s.id === id)!;

describe("executeSkill", () => {
  it("assembles platform + vertical + skill instructions and the company context", async () => {
    const { runtime, calls } = recordingRuntime('Here is the rewrite:\n"Hi John — quick follow-up."');
    const result = await executeSkill({
      vertical: marketingVertical,
      skill: skill("rewrite-brand-voice"),
      ctx,
      runtime,
      input: { text: "Hi John, just wanted to follow up." },
    });
    expect(result.text).toBe("Hi John — quick follow-up.");
    const call = calls[0]!;
    expect(call.system).toContain("You are ContextOS");
    expect(call.system).toContain("Marketing intelligence");
    expect(call.system).toContain("Current skill: Rewrite in Brand Voice");
    expect(call.system).toContain("Head of Marketing");
    expect(call.system).toContain("Gmail message");
    expect(call.prompt).toContain("<context>");
    expect(call.prompt).toContain("Confident, Minimal");
    expect(call.prompt).toContain("<text>\nHi John, just wanted to follow up.\n</text>");
    expect(call.taskType).toBe("writing");
  });

  it("requires text for text-based skills", async () => {
    const { runtime } = recordingRuntime("x");
    await expect(
      executeSkill({ vertical: marketingVertical, skill: skill("shorten"), ctx, runtime, input: { text: "" } }),
    ).rejects.toBeInstanceOf(SkillInputError);
  });

  it("passes action options into the prompt", async () => {
    const { runtime, calls } = recordingRuntime("ok");
    await executeSkill({
      vertical: marketingVertical,
      skill: skill("improve-copy"),
      ctx,
      runtime,
      input: { text: "Buy now", options: { focus: "conversion" } },
    });
    expect(calls[0]!.prompt).toMatch(/conversion/);
  });

  it("renders structured skills and exposes extras", async () => {
    const { runtime } = recordingRuntime(JSON.stringify({ subject: "Meet Northstar", previewText: "Rest is a skill", body: "Hi Sam,\n\nBody", cta: "Join" }));
    const result = await executeSkill({ vertical: marketingVertical, skill: skill("email-generator"), ctx, runtime, input: { text: "" } });
    expect(result.text).toBe("Hi Sam,\n\nBody");
    expect(result.extras).toEqual([
      { label: "Subject", value: "Meet Northstar" },
      { label: "Preview text", value: "Rest is a skill" },
    ]);
  });

  it("refines a previous result as a follow-up turn", async () => {
    const { runtime, calls } = recordingRuntime("Shorter version");
    await executeSkill({
      vertical: marketingVertical,
      skill: skill("rewrite-brand-voice"),
      ctx,
      runtime,
      input: { text: "Original" },
      refinement: { previousOutput: "First draft", instruction: "make it shorter" },
    });
    expect(calls[0]!.history?.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(calls[0]!.history?.[1]?.content).toBe("First draft");
    expect(calls[0]!.prompt).toContain("make it shorter");
  });

  it("runs the multi-step campaign workflow end to end", async () => {
    const router = new ModelRouter({ providers: [], fallback: new DemoProvider() });
    const runtime: WorkflowRuntime = {
      generateText: async (req) => (await router.generate({ taskType: req.taskType, systemPrompt: req.system, messages: [{ role: "user", content: req.prompt }] })).text,
      generateObject: async (req, schema) =>
        (await router.generateObject({ taskType: req.taskType, systemPrompt: req.system, messages: [{ role: "user", content: req.prompt }], metadata: { product: "Northstar Band" } }, schema)).object,
    };
    const result = await executeSkill({ vertical: marketingVertical, skill: skill("campaign-ideas"), ctx, runtime, input: { text: "" } });
    expect(result.trace.map((t) => t.name)).toEqual([
      "Load company context",
      "Load marketing vertical context",
      "Analyze goal",
      "Identify target customer",
      "Determine positioning",
      "Generate message",
      "Create channel recommendations",
      "Return structured campaign",
    ]);
    expect(result.text).toContain("Campaign:");
    expect(result.text).toContain("Channels:");
  });
});

describe("cleanTextOutput", () => {
  it("strips preambles, fences and wrapping quotes", () => {
    expect(cleanTextOutput("Sure! Here's a rewrite:\n\nHello")).toBe("Hello");
    expect(cleanTextOutput("```\nHello\n```")).toBe("Hello");
    expect(cleanTextOutput('"Hello there"')).toBe("Hello there");
    expect(cleanTextOutput('He said "hi" and "bye"')).toBe('He said "hi" and "bye"');
  });
});
