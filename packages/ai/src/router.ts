import { z } from "zod";
import {
  AIProviderError,
  type AIProvider,
  type GenerateRequest,
  type GenerateResult,
  type ModelTier,
  type ProviderId,
  type TaskType,
} from "./types";
import { parseJsonFromText } from "./structured";

export interface RouteCandidate {
  provider: ProviderId;
  tier: ModelTier;
}

/**
 * Task type → ordered candidates. This is the single place where "which model
 * is best for what" lives; later it can be learned, priced or A/B tested.
 */
export const DEFAULT_ROUTING: Record<TaskType, RouteCandidate[]> = {
  "fast-rewrite": [
    { provider: "anthropic", tier: "balanced" },
    { provider: "openai", tier: "fast" },
    { provider: "gemini", tier: "fast" },
  ],
  writing: [
    { provider: "anthropic", tier: "balanced" },
    { provider: "openai", tier: "balanced" },
    { provider: "gemini", tier: "balanced" },
  ],
  reasoning: [
    { provider: "anthropic", tier: "powerful" },
    { provider: "openai", tier: "powerful" },
    { provider: "gemini", tier: "powerful" },
  ],
  research: [
    { provider: "gemini", tier: "balanced" },
    { provider: "anthropic", tier: "balanced" },
    { provider: "openai", tier: "balanced" },
  ],
  structured: [
    { provider: "anthropic", tier: "balanced" },
    { provider: "openai", tier: "balanced" },
    { provider: "gemini", tier: "balanced" },
  ],
};

export interface RouteDecision {
  provider: AIProvider;
  model: string;
  reason: string;
}

export interface ModelRouterOptions {
  providers: AIProvider[];
  routing?: Partial<Record<TaskType, RouteCandidate[]>>;
  /** Provider used when nothing else is configured (the offline demo provider). */
  fallback?: AIProvider;
}

export interface ProviderStatus {
  id: ProviderId;
  displayName: string;
  configured: boolean;
  models: Record<ModelTier, string>;
}

export class ModelRouter {
  private readonly providers = new Map<ProviderId, AIProvider>();
  private readonly routing: Record<TaskType, RouteCandidate[]>;
  private readonly fallback?: AIProvider;

  constructor(options: ModelRouterOptions) {
    for (const provider of options.providers) this.providers.set(provider.id, provider);
    this.routing = { ...DEFAULT_ROUTING, ...options.routing };
    this.fallback = options.fallback;
  }

  listProviders(): ProviderStatus[] {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      displayName: p.displayName,
      configured: p.isConfigured(),
      models: p.models,
    }));
  }

  /** True when at least one real (non-demo) provider has credentials. */
  hasLiveProvider(): boolean {
    return [...this.providers.values()].some((p) => p.id !== "demo" && p.isConfigured());
  }

  /** Ordered list of provider/model pairs to try for a request. */
  plan(request: Pick<GenerateRequest, "taskType" | "preferredProvider" | "model">): RouteDecision[] {
    const decisions: RouteDecision[] = [];
    const seen = new Set<ProviderId>();
    const candidates = this.routing[request.taskType] ?? this.routing.writing;
    const tierFor = (id: ProviderId): ModelTier =>
      candidates.find((c) => c.provider === id)?.tier ?? "balanced";

    const push = (provider: AIProvider | undefined, reason: string) => {
      if (!provider || seen.has(provider.id) || !provider.isConfigured()) return;
      seen.add(provider.id);
      decisions.push({
        provider,
        model: request.model ?? provider.models[tierFor(provider.id)],
        reason,
      });
    };

    const preferred = request.preferredProvider;
    if (preferred && preferred !== "auto") {
      push(this.providers.get(preferred), `user preference: ${preferred}`);
    }
    for (const candidate of candidates) {
      push(this.providers.get(candidate.provider), `routing rule for ${request.taskType}`);
    }
    for (const provider of this.providers.values()) {
      if (provider.id !== "demo") push(provider, "first configured provider");
    }
    if (decisions.length === 0 && this.fallback) {
      push(this.fallback, "no provider configured — offline demo model");
    }
    return decisions;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const plan = this.plan(request);
    if (plan.length === 0) {
      throw new AIProviderError("No AI provider is configured", "demo");
    }
    let lastError: unknown;
    for (const decision of plan) {
      const started = Date.now();
      try {
        const response = await decision.provider.generate({ ...request, model: decision.model });
        return {
          ...response,
          provider: decision.provider.id,
          model: decision.model,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        lastError = error;
        // Only fail over on transient errors; auth / validation errors surface immediately.
        if (!(error instanceof AIProviderError) || !error.retryable) throw error;
      }
    }
    throw lastError;
  }

  /**
   * Generate JSON validated by a zod schema. Retries once, feeding the
   * validation error back to the model.
   */
  async generateObject<T>(
    request: Omit<GenerateRequest, "schema">,
    schema: z.ZodType<T>,
  ): Promise<{ object: T; result: GenerateResult }> {
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    let messages = request.messages;
    let lastIssue = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.generate({ ...request, messages, schema: jsonSchema });
      const parsed = schema.safeParse(parseJsonFromText(result.text));
      if (parsed.success) return { object: parsed.data, result };
      lastIssue = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      messages = [
        ...messages,
        { role: "assistant", content: result.text },
        {
          role: "user",
          content: `That JSON did not match the schema (${lastIssue}). Return only corrected JSON.`,
        },
      ];
    }
    throw new AIProviderError(`Model returned invalid structured output: ${lastIssue}`, "demo");
  }
}
