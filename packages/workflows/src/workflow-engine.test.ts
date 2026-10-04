import { describe, expect, it } from "vitest";
import { z } from "zod";
import { objectStep, runWorkflow, textStep, transformStep, WorkflowError } from "./workflow-engine";
import type { WorkflowDefinition, WorkflowRuntime } from "./types";

const runtime: WorkflowRuntime = {
  generateText: async (req) => `text(${req.prompt})`,
  generateObject: async <T,>(_req: unknown, schema: z.ZodType<T>) => schema.parse({ value: 42 }),
};
const shared = { system: "sys", contextText: "ctx", prompt: "p" };

describe("runWorkflow", () => {
  it("runs steps in order and threads results", async () => {
    const wf: WorkflowDefinition<{ topic: string }, string> = {
      id: "t",
      name: "Test",
      description: "",
      steps: [
        transformStep("a", "A", (s) => s.input.topic.toUpperCase()),
        textStep({ id: "b", name: "B", taskType: "writing", prompt: (s) => String(s.results.a) }),
        objectStep({ id: "c", name: "C", schema: z.object({ value: z.number() }), prompt: () => "obj" }),
      ],
      output: (s) => `${s.results.b}:${(s.results.c as { value: number }).value}`,
    };
    const result = await runWorkflow(wf, { topic: "launch" }, shared, runtime);
    expect(result.output).toBe("text(LAUNCH):42");
    expect(result.trace.map((t) => t.stepId)).toEqual(["a", "b", "c"]);
    expect(result.trace.every((t) => t.status === "succeeded")).toBe(true);
  });

  it("reports the failing step with a trace", async () => {
    const wf: WorkflowDefinition<unknown, unknown> = {
      id: "f",
      name: "Fail",
      description: "",
      steps: [
        transformStep("ok", "OK", () => 1),
        transformStep("boom", "Boom", () => {
          throw new Error("nope");
        }),
      ],
      output: () => null,
    };
    const error = await runWorkflow(wf, {}, shared, runtime).catch((e) => e);
    expect(error).toBeInstanceOf(WorkflowError);
    expect(error.stepId).toBe("boom");
    expect(error.trace.map((t: { status: string }) => t.status)).toEqual(["succeeded", "failed"]);
  });
});
