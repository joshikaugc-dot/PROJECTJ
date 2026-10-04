import { z } from "zod";
import { appContextSchema } from "./app-context";
import type { ContextBlock } from "./context";

/**
 * Contract between clients (Chrome extension today, desktop apps later) and
 * the ContextOS API. Clients only ever talk to the platform through these
 * shapes, which is what lets new surfaces be added without backend changes.
 */

export const EXECUTION_ACTION_TYPES = ["replace", "insert", "copy"] as const;
export type ExecutionActionType = (typeof EXECUTION_ACTION_TYPES)[number];

export const recommendRequestSchema = z.object({
  appContext: appContextSchema,
  verticalId: z.string().optional(),
});
export type RecommendRequest = z.input<typeof recommendRequestSchema>;

export interface RecommendedAction {
  id: string;
  verticalId: string;
  skillId: string;
  label: string;
  description?: string;
  icon?: string;
  /** Why this action was recommended (for debugging + transparency). */
  reason?: string;
}

export interface VerticalSummary {
  id: string;
  name: string;
  description: string;
  status: "available" | "coming-soon";
}

export interface RecommendResponse {
  vertical: VerticalSummary;
  enabledVerticals: VerticalSummary[];
  actions: RecommendedAction[];
  askPlaceholder: string;
  /** Labels that will likely be used, shown before anything is sent to a model. */
  contextPreview: string[];
}

export const runRequestSchema = z
  .object({
    appContext: appContextSchema,
    verticalId: z.string().optional(),
    actionId: z.string().optional(),
    skillId: z.string().optional(),
    /** Free-form instruction ("Ask Marketing AI…") or refinement ("shorter"). */
    instruction: z.string().max(4000).optional(),
    options: z.record(z.string(), z.string()).optional(),
    /** Opt-in: allow surrounding page context (e.g. the email thread) to be used. */
    includePageContext: z.boolean().optional(),
    /** When refining, the previous output that should be revised. */
    previousOutput: z.string().max(20_000).optional(),
    conversationId: z.string().optional(),
    preferredProvider: z.string().optional(),
  })
  .refine((v) => v.actionId || v.skillId || v.instruction, {
    message: "One of actionId, skillId or instruction is required",
  });
export type RunRequest = z.input<typeof runRequestSchema>;

export interface RunResponse {
  actionRecordId: string | null;
  conversationId: string | null;
  output: string;
  structured?: unknown;
  /** Secondary fields (e.g. an email subject) shown next to the main output. */
  extras?: { label: string; value: string }[];
  vertical: { id: string; name: string };
  skill: { id: string; name: string };
  context: { labels: string[]; blocks: ContextBlock[] };
  provider: string;
  model: string;
  latencyMs: number;
  allowedActions: ExecutionActionType[];
  /** True when no AI provider key is configured and the offline demo model answered. */
  demoMode: boolean;
  workflowTrace: { stepId: string; name: string; durationMs: number }[];
}

export const executedRequestSchema = z.object({
  type: z.enum(EXECUTION_ACTION_TYPES),
});

export interface BootstrapResponse {
  product: { name: string };
  user: { id: string; name: string; email: string; role: string | null };
  organization: { id: string; name: string } | null;
  activeVertical: VerticalSummary | null;
  enabledVerticals: VerticalSummary[];
  preferences: { historyEnabled: boolean; includePageContext: boolean; preferredProvider: string };
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
