import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AnthropicProvider } from "./providers/anthropic";
import { DemoProvider } from "./providers/demo";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { ModelRouter } from "./router";
import { parseJsonFromText } from "./structured";
import { AIProviderError, type AIProvider, type ProviderRequest } from "./types";

function fakeProvider(id: "anthropic" | "openai" | "gemini", impl: (r: ProviderRequest) => string | Promise<string>, configured = true): AIProvider {
  return {
    id,
    displayName: id,
    models: { fast: `${id}-fast`, balanced: `${id}-balanced`, powerful: `${id}-powerful` },
    isConfigured: () => configured,
    generate: async (r) => ({ text: await impl(r) }),
  };
}

const msg = [{ role: "user" as const, content: "hi" }];

describe("ModelRouter", () => {
  it("routes by task type and tier", () => {
    const router = new ModelRouter({ providers: [fakeProvider("anthropic", () => "a"), fakeProvider("gemini", () => "g")] });
    expect(router.plan({ taskType: "reasoning" })[0]).toMatchObject({ model: "anthropic-powerful" });
    expect(router.plan({ taskType: "research" })[0]).toMatchObject({ model: "gemini-balanced" });
  });

  it("honours the user's preferred provider", () => {
    const router = new ModelRouter({ providers: [fakeProvider("anthropic", () => "a"), fakeProvider("openai", () => "o")] });
    expect(router.plan({ taskType: "writing", preferredProvider: "openai" })[0]!.provider.id).toBe("openai");
  });

  it("skips unconfigured providers and falls back to the demo model", async () => {
    const router = new ModelRouter({
      providers: [fakeProvider("anthropic", () => "a", false)],
      fallback: new DemoProvider(),
    });
    const result = await router.generate({ taskType: "writing", messages: msg });
    expect(result.provider).toBe("demo");
  });

  it("fails over on retryable errors only", async () => {
    const flaky = fakeProvider("anthropic", () => {
      throw new AIProviderError("overloaded", "anthropic", 529, true);
    });
    const router = new ModelRouter({ providers: [flaky, fakeProvider("openai", () => "from openai")] });
    expect((await router.generate({ taskType: "writing", messages: msg })).text).toBe("from openai");

    const broken = fakeProvider("anthropic", () => {
      throw new AIProviderError("bad key", "anthropic", 401, false);
    });
    const router2 = new ModelRouter({ providers: [broken, fakeProvider("openai", () => "x")] });
    await expect(router2.generate({ taskType: "writing", messages: msg })).rejects.toThrow("bad key");
  });

  it("validates structured output and retries with the error", async () => {
    const replies = ["not json", '```json\n{"title": "Launch"}\n```'];
    const provider = fakeProvider("anthropic", () => replies.shift()!);
    const router = new ModelRouter({ providers: [provider] });
    const { object } = await router.generateObject({ taskType: "structured", messages: msg }, z.object({ title: z.string() }));
    expect(object.title).toBe("Launch");
  });
});

describe("providers", () => {
  it("Anthropic sends a Messages API request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "Hello" }], usage: { input_tokens: 3, output_tokens: 1 } }), { status: 200 }),
    );
    const provider = new AnthropicProvider({ apiKey: "k", fetch: fetchMock as unknown as typeof fetch });
    const result = await provider.generate({ model: "claude-sonnet-5-5", taskType: "writing", systemPrompt: "sys", messages: msg });
    expect(result).toMatchObject({ text: "Hello", usage: { inputTokens: 3, outputTokens: 1 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "claude-sonnet-5-5", system: "sys" });
  });

  it("OpenAI and Gemini translate the generic request", async () => {
    const openaiFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "o" } }] })));
    const geminiFetch = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "g" }] } }] })));
    expect((await new OpenAIProvider({ apiKey: "k", fetch: openaiFetch as unknown as typeof fetch }).generate({ model: "m", taskType: "writing", messages: msg, systemPrompt: "s" })).text).toBe("o");
    expect((await new GeminiProvider({ apiKey: "k", fetch: geminiFetch as unknown as typeof fetch }).generate({ model: "m", taskType: "writing", messages: msg, systemPrompt: "s" })).text).toBe("g");
    const openaiBody = JSON.parse((openaiFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(openaiBody.messages[0]).toEqual({ role: "system", content: "s" });
    const geminiBody = JSON.parse((geminiFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(geminiBody.systemInstruction.parts[0].text).toBe("s");
  });

  it("surfaces HTTP errors with retryability", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 }));
    const error = await new AnthropicProvider({ apiKey: "k", fetch: fetchMock as unknown as typeof fetch })
      .generate({ model: "m", taskType: "writing", messages: msg })
      .catch((e) => e);
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("rate limited");
  });
});

describe("parseJsonFromText", () => {
  it("handles fences and surrounding prose", () => {
    expect(parseJsonFromText('Sure! {"a": 1} hope that helps')).toEqual({ a: 1 });
    expect(parseJsonFromText("```\n[1,2]\n```")).toEqual([1, 2]);
    expect(parseJsonFromText("nope")).toBeUndefined();
  });
});
