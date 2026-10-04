import type { AIProvider, ModelTier, ProviderRequest, ProviderResponse } from "../types";
import { postJson, jsonInstruction, joinSystem, type FetchLike } from "./http";

export interface AnthropicProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: Partial<Record<ModelTier, string>>;
  fetch?: FetchLike;
}

interface AnthropicMessageResponse {
  content: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export const ANTHROPIC_DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-5-5",
  powerful: "claude-opus-5-5",
};

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  readonly displayName = "Claude (Anthropic)";
  readonly models: Record<ModelTier, string>;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.models = { ...ANTHROPIC_DEFAULT_MODELS, ...options.models };
    this.fetchImpl = options.fetch ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const system = joinSystem(
      request.systemPrompt,
      request.schema ? jsonInstruction(request.schema) : undefined,
    );
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 2048,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (system) body.system = system;
    if (request.temperature !== undefined) body.temperature = request.temperature;

    const data = (await postJson(
      this.id,
      this.fetchImpl,
      `${this.baseUrl}/v1/messages`,
      { "x-api-key": this.apiKey ?? "", "anthropic-version": "2023-06-01" },
      body,
      request.signal,
    )) as AnthropicMessageResponse;

    const text = data.content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");

    return {
      text,
      stopReason: data.stop_reason,
      usage: data.usage
        ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
        : undefined,
    };
  }
}
