import type { z } from "zod";
import type { TaskType } from "@contextos/ai";

/**
 * The capabilities a workflow step may use. Supplied by the host (the API
 * server) so workflows never import a provider or a database directly.
 */
export interface WorkflowRuntime {
  generateText(request: StepGenerateRequest): Promise<string>;
  generateObject<T>(request: StepGenerateRequest, schema: z.ZodType<T>): Promise<T>;
}

export interface StepGenerateRequest {
  system: string;
  prompt: string;
  taskType: TaskType;
  maxTokens?: number;
  /** Prior turns, used for refinement ("make it shorter"). */
  history?: { role: "user" | "assistant"; content: string }[];
}

/**
 * Mutable state threaded through a workflow run.
 * - `input`: the validated skill input.
 * - `shared`: values the host provides to every step (system prompt, context text…).
 * - `results`: each step's output keyed by step id.
 */
export interface WorkflowState<TInput = unknown> {
  input: TInput;
  shared: WorkflowShared;
  results: Record<string, unknown>;
}

export interface WorkflowShared {
  /** System prompt assembled from platform + vertical + skill instructions. */
  system: string;
  /** Rendered company/app context section. */
  contextText: string;
  /** The skill's primary user prompt (for single-step workflows). */
  prompt: string;
  /** Free-form extras a host or step may set. */
  [key: string]: unknown;
}

export interface WorkflowStep<TInput = unknown> {
  id: string;
  name: string;
  description?: string;
  run(state: WorkflowState<TInput>, runtime: WorkflowRuntime): Promise<unknown> | unknown;
}

export interface WorkflowDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep<TInput>[];
  /** Produces the workflow output from the final state. */
  output(state: WorkflowState<TInput>): TOutput;
}

export interface StepTrace {
  stepId: string;
  name: string;
  durationMs: number;
  status: "succeeded" | "failed";
  error?: string;
}

export interface WorkflowRunResult<TOutput> {
  output: TOutput;
  trace: StepTrace[];
  results: Record<string, unknown>;
}
