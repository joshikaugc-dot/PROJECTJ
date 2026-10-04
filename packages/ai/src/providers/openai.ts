import type { AIProvider, ModelTier, ProviderRequest, ProviderResponse } from "../types";
import { postJson, jsonInstruction, joinSystem, type FetchLike } from "./http";

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: Partial<Record<ModelTier, string>>;
  fetch?: FetchLike;
}

interface ChatCompletionResponse {
  choices: { message: { content: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export const OPENAI_DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "gpt-5-mini",
  balanced: "gpt-5",
  powerful: "gpt-5",
};

/**
 * OpenAI Chat Completions provider. Implemented against the stable REST API so
 * no SDK is required. Model ids are configurable via environment variables.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  readonly displayName = "GPT (OpenAI)";
  readonly models: Record<ModelTier, string>;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");
    this.models = { ...OPENAI_DEFAULT_MODELS, ...options.models };
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
    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...request.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_completion_tokens: request.maxTokens ?? 2048,
    };
    if (request.schema) body.response_format = { type: "json_object" };

    const data = (await postJson(
      this.id,
      this.fetchImpl,
      `${this.baseUrl}/v1/chat/completions`,
      { authorization: `Bearer ${this.apiKey ?? ""}` },
      body,
      request.signal,
    )) as ChatCompletionResponse;

    const choice = data.choices[0];
    return {
      text: choice?.message.content ?? "",
      stopReason: choice?.finish_reason,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
    };
  }
}
