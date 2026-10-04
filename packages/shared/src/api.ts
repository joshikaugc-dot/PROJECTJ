import type { AppContext } from "./app-context";
import type { ContextBlock } from "./context";

/**
 * Contract between clients (Chrome extension today, desktop apps later) and
 * the ContextOS API. Clients only ever talk to the platform through these
 * shapes, which is what lets new surfaces be added without backend changes.
 */

export const EXECUTION_ACTION_TYPES = ["replace", "insert", "copy"] as const;
export type ExecutionActionType = (typeof EXECUTION_ACTION_TYPES)[number];

export interface RecommendRequest {
  appContext: AppContext;
  verticalId?: string;
}

export interface RecommendedAction {
  id: string;
  verticalId: string;
  skillId: string;
  label: string;
  description?: string;
  icon?: string;
  /** Why this action was recommended (for debugging + transparency). */
  reason?: string;
  /** The action works from surrounding page text (e.g. the email thread). */
  usesPageContext?: boolean;
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

export interface RunRequest {
  appContext: AppContext;
  verticalId?: string;
  actionId?: string;
  skillId?: string;
  /** Free-form instruction ("Ask Marketing AI…") or refinement ("shorter"). */
  instruction?: string;
  options?: Record<string, string>;
  /** Opt-in: allow surrounding page context (e.g. the email thread) to be used. */
  includePageContext?: boolean;
  /** When refining, the previous output that should be revised. */
  previousOutput?: string;
  conversationId?: string;
  preferredProvider?: string;
}

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
