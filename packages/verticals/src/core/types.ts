import { z } from "zod";
import type { ProviderPreference, TaskType } from "@contextos/ai";
import type {
  AppContext,
  ContextKey,
  ExecutionActionType,
  RelevantContext,
  UserContext,
} from "@contextos/shared";
import type { WorkflowDefinition } from "@contextos/workflows";

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

/** Input every skill receives. Skills may narrow/extend it via inputSchema. */
export const skillInputSchema = z.object({
  /** The text being worked on: selection, or the focused field's content. */
  text: z.string().default(""),
  /** Free-form user instruction ("Ask Marketing AI…"). */
  instruction: z.string().optional(),
  /** Action-specific knobs, e.g. { channel: "linkedin" } or { focus: "conversion" }. */
  options: z.record(z.string(), z.string()).default({}),
  /** Surrounding context (email thread, post being commented on), when permitted. */
  nearbyText: z.string().optional(),
});
export type SkillInput = z.infer<typeof skillInputSchema>;

/** Everything a skill can read when building its prompt. */
export interface SkillRunContext {
  appContext: AppContext;
  user: UserContext | null;
  companyName: string;
  verticalName: string;
  context: RelevantContext;
}

export interface SkillExtra {
  label: string;
  value: string;
}

export interface SkillDefinition<TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  /** Validates/normalizes input before execution. */
  inputSchema: z.ZodType<SkillInput, z.input<typeof skillInputSchema>>;
  /** Shape of the model output. Text skills use z.string(). */
  outputSchema: z.ZodType<TOutput>;
  output: "text" | "json";
  /** Skill-specific instructions appended to the vertical's system prompt. */
  systemInstructions: string;
  /** Context the engine must include. */
  requiredContext: ContextKey[];
  /** Context the engine may include when relevant. */
  optionalContext?: ContextKey[];
  /** Routing hint — never a hardcoded model. */
  preferredModel: { taskType: TaskType; provider?: ProviderPreference };
  /** What the user may do with the result. */
  allowedActions: ExecutionActionType[];
  /** Whether the skill needs selected/field text to operate on. */
  requiresText: boolean;
  maxTokens?: number;
  /** Builds the task-specific part of the user prompt. */
  buildPrompt(input: SkillInput, ctx: SkillRunContext): string;
  /** Converts structured output into insertable text. */
  render?(output: TOutput): string;
  /** Secondary fields shown separately in the overlay (e.g. email subject). */
  extras?(output: TOutput): SkillExtra[];
  /** Multi-step workflow. When omitted the skill runs as a single generation. */
  workflow?: WorkflowDefinition<SkillInput, TOutput>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySkill = SkillDefinition<any>;

/* ------------------------------------------------------------------ */
/* Actions (what the overlay shows)                                    */
/* ------------------------------------------------------------------ */

export interface ActionDefinition {
  id: string;
  label: string;
  description?: string;
  skillId: string;
  icon?: string;
  /** Options passed to the skill (e.g. { focus: "conversion" }). */
  options?: Record<string, string>;
  /** Base score; higher shows first. */
  priority: number;
  /** Hard filter: only show in these apps / surfaces. */
  appliesTo?: { apps?: string[]; surfaces?: string[] };
  /** Boost when the user's role matches any of these keywords. */
  roles?: string[];
  requiresSelection?: boolean;
  /** Requires selection *or* field text. */
  requiresText?: boolean;
  requiresEditable?: boolean;
  /** Only show when there is no text to work on (e.g. "Write a post"). */
  onlyWithoutText?: boolean;
  /** Generic actions this more specific action replaces (de-duplication). */
  supersedes?: string[];
}

/* ------------------------------------------------------------------ */
/* Verticals                                                           */
/* ------------------------------------------------------------------ */

export type VerticalStatus = "available" | "coming-soon";

export interface VerticalDefinition {
  id: string;
  name: string;
  description: string;
  tagline?: string;
  version: string;
  status: VerticalStatus;
  icon?: string;
  /** Persona the vertical gives the model. */
  systemPrompt: string;
  skills: AnySkill[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflows: WorkflowDefinition<any, any>[];
  recommendedActions: ActionDefinition[];
  /** App ids this vertical has tuned actions for (informational). */
  supportedContexts?: string[];
  /** Roles that typically use this vertical (used for onboarding + ranking). */
  suggestedRoles?: string[];
  /** Placeholder for not-yet-built verticals. */
  plannedSkills?: string[];
  /** Placeholder text for the free-form input. */
  askPlaceholder?: string;
  /** Skill used for free-form requests. */
  askSkillId?: string;
}
