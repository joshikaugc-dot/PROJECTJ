/**
 * Provider-neutral model abstraction. Nothing in here is shaped after a
 * specific vendor's API — providers translate to and from these types.
 */

export type ProviderId = "anthropic" | "openai" | "gemini" | "demo";
export type ProviderPreference = ProviderId | "auto";

/**
 * What kind of work a request is. The router maps task types to models, so
 * skills describe *what* they need and never hardcode a model.
 */
export type TaskType =
  | "fast-rewrite" // short edits where latency matters most
  | "writing" // long-form, quality-sensitive copy
  | "reasoning" // multi-step analysis / strategy
  | "research" // synthesis over provided material
  | "structured"; // JSON output that must match a schema

export type ModelTier = "fast" | "balanced" | "powerful";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A JSON Schema object (draft 2020-12 subset), produced from zod schemas. */
export type JsonSchema = Record<string, unknown>;

export interface GenerateRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  /** When present the model is asked for JSON matching this schema. */
  schema?: JsonSchema;
  taskType: TaskType;
  preferredProvider?: ProviderPreference;
  /** Explicit model override; bypasses tier selection. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Free-form tags (skill id, vertical id) for logging and the demo provider. */
  metadata?: Record<string, string>;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderRequest extends Omit<GenerateRequest, "preferredProvider"> {
  model: string;
}

export interface ProviderResponse {
  text: string;
  usage?: TokenUsage;
  stopReason?: string;
}

export interface GenerateResult extends ProviderResponse {
  provider: ProviderId;
  model: string;
  latencyMs: number;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  /** Model id per tier. */
  readonly models: Record<ModelTier, string>;
  isConfigured(): boolean;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
