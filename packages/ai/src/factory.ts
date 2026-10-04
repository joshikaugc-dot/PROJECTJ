import { ModelRouter } from "./router";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { DemoProvider } from "./providers/demo";
import type { ModelTier } from "./types";

export type AIEnv = Record<string, string | undefined>;

function tierModels(env: AIEnv, prefix: string): Partial<Record<ModelTier, string>> {
  const models: Partial<Record<ModelTier, string>> = {};
  const fast = env[`${prefix}_MODEL_FAST`];
  const balanced = env[`${prefix}_MODEL_BALANCED`];
  const powerful = env[`${prefix}_MODEL_POWERFUL`];
  if (fast) models.fast = fast;
  if (balanced) models.balanced = balanced;
  if (powerful) models.powerful = powerful;
  return models;
}

/**
 * Build the default router from environment variables. Adding a provider means
 * implementing AIProvider and registering it here — nothing else changes.
 */
export function createModelRouterFromEnv(env: AIEnv): ModelRouter {
  const demoAllowed = env.CONTEXTOS_DISABLE_DEMO_MODEL !== "true";
  return new ModelRouter({
    providers: [
      new AnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        baseUrl: env.CONTEXTOS_ANTHROPIC_BASE_URL,
        models: tierModels(env, "ANTHROPIC"),
      }),
      new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.CONTEXTOS_OPENAI_BASE_URL,
        models: tierModels(env, "OPENAI"),
      }),
      new GeminiProvider({
        apiKey: env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY,
        models: tierModels(env, "GEMINI"),
      }),
    ],
    fallback: demoAllowed ? new DemoProvider() : undefined,
  });
}
