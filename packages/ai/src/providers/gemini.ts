import type { AIProvider, ModelTier, ProviderRequest, ProviderResponse } from "../types";
import { postJson, jsonInstruction, joinSystem, type FetchLike } from "./http";

export interface GeminiProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: Partial<Record<ModelTier, string>>;
  fetch?: FetchLike;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export const GEMINI_DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "gemini-2.5-flash",
  balanced: "gemini-2.5-pro",
  powerful: "gemini-2.5-pro",
};

/** Google Gemini provider using the public generateContent REST endpoint. */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly displayName = "Gemini (Google)";
  readonly models: Record<ModelTier, string>;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    this.models = { ...GEMINI_DEFAULT_MODELS, ...options.models };
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
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: request.maxTokens ?? 2048,
    };
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.schema) generationConfig.responseMimeType = "application/json";

    const body: Record<string, unknown> = {
      contents: request.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig,
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const data = (await postJson(
      this.id,
      this.fetchImpl,
      `${this.baseUrl}/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
      { "x-goog-api-key": this.apiKey ?? "" },
      body,
      request.signal,
    )) as GenerateContentResponse;

    const candidate = data.candidates?.[0];
    return {
      text: candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
      stopReason: candidate?.finishReason,
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }
}
