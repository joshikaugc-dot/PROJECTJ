import { z } from "zod";
import {
  runWorkflow,
  type StepTrace,
  type WorkflowDefinition,
  type WorkflowRuntime,
} from "@contextos/workflows";
import { buildSkillPrompt, cleanTextOutput } from "./prompt";
import type { AnySkill, SkillExtra, SkillInput, SkillRunContext, VerticalDefinition } from "./types";

export class SkillInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillInputError";
  }
}

export interface Refinement {
  previousOutput: string;
  instruction: string;
}

export interface ExecuteSkillParams {
  vertical: VerticalDefinition;
  skill: AnySkill;
  input: z.input<AnySkill["inputSchema"]>;
  ctx: SkillRunContext;
  runtime: WorkflowRuntime;
  refinement?: Refinement;
}

export interface SkillResult {
  /** Insertable text. */
  text: string;
  /** Raw (possibly structured) output. */
  output: unknown;
  extras: SkillExtra[];
  trace: StepTrace[];
}

/**
 * Every skill runs through the workflow engine. Skills without a custom
 * workflow get a single "generate" step, so single-shot and multi-step skills
 * share one execution path, one trace format and one runtime.
 */
export function singleStepWorkflow(skill: AnySkill): WorkflowDefinition<SkillInput, unknown> {
  return {
    id: `${skill.id}.single`,
    name: skill.name,
    description: `Single-step generation for ${skill.name}`,
    steps: [
      {
        id: "generate",
        name: `Generate (${skill.name})`,
        run: (state, runtime) => {
          const request = {
            system: state.shared.system,
            prompt: state.shared.prompt,
            taskType: skill.preferredModel.taskType,
            maxTokens: skill.maxTokens,
            history: state.shared.history as { role: "user" | "assistant"; content: string }[] | undefined,
          };
          return skill.output === "json"
            ? runtime.generateObject(request, skill.outputSchema)
            : runtime.generateText(request);
        },
      },
    ],
    output: (state) => state.results.generate,
  };
}

export async function executeSkill(params: ExecuteSkillParams): Promise<SkillResult> {
  const { vertical, skill, ctx, runtime, refinement } = params;
  const input = skill.inputSchema.parse(params.input);

  if (skill.requiresText && !input.text.trim() && !input.instruction?.trim() && !input.nearbyText) {
    throw new SkillInputError(
      "Select some text (or place your cursor in a field that has text) for this action.",
    );
  }

  const built = buildSkillPrompt(vertical, skill, input, ctx);
  let prompt = built.prompt;
  let history: { role: "user" | "assistant"; content: string }[] | undefined;

  if (refinement && skill.output === "text" && !skill.workflow) {
    history = [
      { role: "user", content: built.prompt },
      { role: "assistant", content: refinement.previousOutput },
    ];
    prompt = `Revise your previous output: ${refinement.instruction}\nReturn only the revised deliverable.`;
  } else if (refinement) {
    prompt = `${built.prompt}\n\nThe previous result was:\n${refinement.previousOutput}\n\nRevise it: ${refinement.instruction}`;
  }

  const workflow = skill.workflow ?? singleStepWorkflow(skill);
  const result = await runWorkflow(
    workflow,
    input,
    { system: built.system, contextText: built.contextText, prompt, history },
    runtime,
  );

  const output = result.output;
  const text =
    skill.output === "text"
      ? cleanTextOutput(String(output ?? ""))
      : (skill.render?.(output) ?? JSON.stringify(output, null, 2));

  return {
    text,
    output,
    extras: skill.extras?.(output) ?? [],
    trace: result.trace,
  };
}
