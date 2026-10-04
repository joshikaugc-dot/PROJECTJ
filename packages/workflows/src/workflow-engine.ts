import type { z } from "zod";
import type { TaskType } from "@contextos/ai";
import type {
  StepTrace,
  WorkflowDefinition,
  WorkflowRunResult,
  WorkflowRuntime,
  WorkflowShared,
  WorkflowState,
  WorkflowStep,
} from "./types";

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly stepId: string,
    readonly trace: StepTrace[],
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export interface RunWorkflowOptions {
  onStep?(trace: StepTrace): void;
}

/**
 * Executes a workflow's steps in order. Steps are small and reusable; each
 * one sees the outputs of the steps before it via `state.results`.
 */
export async function runWorkflow<TInput, TOutput>(
  workflow: WorkflowDefinition<TInput, TOutput>,
  input: TInput,
  shared: WorkflowShared,
  runtime: WorkflowRuntime,
  options: RunWorkflowOptions = {},
): Promise<WorkflowRunResult<TOutput>> {
  const state: WorkflowState<TInput> = { input, shared, results: {} };
  const trace: StepTrace[] = [];

  for (const step of workflow.steps) {
    const started = Date.now();
    try {
      state.results[step.id] = await step.run(state, runtime);
      const entry: StepTrace = {
        stepId: step.id,
        name: step.name,
        durationMs: Date.now() - started,
        status: "succeeded",
      };
      trace.push(entry);
      options.onStep?.(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trace.push({
        stepId: step.id,
        name: step.name,
        durationMs: Date.now() - started,
        status: "failed",
        error: message,
      });
      throw new WorkflowError(`Step "${step.name}" failed: ${message}`, step.id, trace);
    }
  }

  return { output: workflow.output(state), trace, results: state.results };
}

/* ------------------------------------------------------------------ */
/* Reusable step builders                                              */
/* ------------------------------------------------------------------ */

type PromptFn<TInput> = (state: WorkflowState<TInput>) => string;

/** A step that only transforms state (no model call). */
export function transformStep<TInput>(
  id: string,
  name: string,
  run: (state: WorkflowState<TInput>) => unknown,
): WorkflowStep<TInput> {
  return { id, name, run: (state) => run(state) };
}

/** A step that asks the model for text. */
export function textStep<TInput>(options: {
  id: string;
  name: string;
  taskType: TaskType;
  prompt: PromptFn<TInput>;
  system?: PromptFn<TInput>;
  maxTokens?: number;
}): WorkflowStep<TInput> {
  return {
    id: options.id,
    name: options.name,
    run: (state, runtime) =>
      runtime.generateText({
        system: options.system?.(state) ?? state.shared.system,
        prompt: options.prompt(state),
        taskType: options.taskType,
        maxTokens: options.maxTokens,
      }),
  };
}

/** A step that asks the model for JSON validated by a zod schema. */
export function objectStep<TInput, T>(options: {
  id: string;
  name: string;
  taskType?: TaskType;
  schema: z.ZodType<T>;
  prompt: PromptFn<TInput>;
  system?: PromptFn<TInput>;
  maxTokens?: number;
}): WorkflowStep<TInput> {
  return {
    id: options.id,
    name: options.name,
    run: (state, runtime) =>
      runtime.generateObject(
        {
          system: options.system?.(state) ?? state.shared.system,
          prompt: options.prompt(state),
          taskType: options.taskType ?? "structured",
          maxTokens: options.maxTokens,
        },
        options.schema,
      ),
  };
}

/** Render prior step results as a compact block for the next prompt. */
export function priorResults(state: WorkflowState<unknown>, stepIds: string[]): string {
  return stepIds
    .filter((id) => state.results[id] !== undefined)
    .map((id) => `<${id}>\n${JSON.stringify(state.results[id], null, 2)}\n</${id}>`)
    .join("\n");
}
