import type { AIProvider, JsonSchema, ModelTier, ProviderRequest, ProviderResponse } from "../types";

/**
 * Offline, deterministic provider used when no API key is configured so the
 * product can be clicked through end-to-end (and tested in CI). It performs
 * simple rule-based edits — it is NOT a language model, and the UI labels its
 * results as demo output.
 *
 * Skills wrap the text to operate on in <text>…</text>; the orchestrator passes
 * a few hints (company/product names) through request.metadata.
 */
export class DemoProvider implements AIProvider {
  readonly id = "demo" as const;
  readonly displayName = "Offline demo model";
  readonly models: Record<ModelTier, string> = {
    fast: "demo-rules-v1",
    balanced: "demo-rules-v1",
    powerful: "demo-rules-v1",
  };

  isConfigured(): boolean {
    return true;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUser?.content ?? "";
    const hints = request.metadata ?? {};
    const text = request.schema
      ? JSON.stringify(sampleFromSchema(request.schema, hints, "result"))
      : demoText(prompt, hints);
    return {
      text,
      stopReason: "end_turn",
      usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(text.length / 4) },
    };
  }
}

const FILLER: [RegExp, string][] = [
  [/\bI just wanted to\b/gi, "I'm writing to"],
  [/\bjust wanted to\b/gi, "wanted to"],
  [/\bI wanted to reach out\b/gi, "I'm reaching out"],
  [/\b(just|really|very|basically|actually|totally)\s+/gi, ""],
  [/\bin order to\b/gi, "to"],
  [/\bat this point in time\b/gi, "now"],
  [/\bregarding\b/gi, "about"],
  [/!{2,}/g, "!"],
  [/\s{2,}/g, " "],
];

function extractTag(prompt: string, tag: string): string | undefined {
  const match = prompt.match(new RegExp(`<${tag}>\\n?([\\s\\S]*?)\\n?</${tag}>`));
  return match?.[1]?.trim();
}

function tighten(text: string): string {
  let out = text;
  for (const [pattern, replacement] of FILLER) out = out.replace(pattern, replacement);
  return out
    .split("\n")
    .map((line) => line.trim().replace(/^([a-z])/, (c) => c.toUpperCase()))
    .join("\n")
    .trim();
}

function sentences(text: string): string[] {
  return text.match(/[^.!?\n]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

function demoText(prompt: string, hints: Record<string, string>): string {
  const skill = hints.skillId ?? "";
  const source = extractTag(prompt, "text") ?? "";
  const instruction = extractTag(prompt, "instruction") ?? "";
  const product = hints.product ?? hints.company ?? "our product";
  const valueLine = hints.productSummary
    ? `${product} ${lowerFirst(hints.productSummary.replace(/\.$/, ""))}.`
    : `${product} is built to make this simple.`;

  switch (skill) {
    case "shorten": {
      const s = sentences(tighten(source));
      return s.slice(0, Math.max(1, Math.ceil(s.length / 2))).join(" ");
    }
    case "rewrite-brand-voice":
    case "improve-copy": {
      const body = tighten(source);
      const lines = body.split("\n");
      const greeting = /^(hi|hello|hey|dear)\b/i.test(lines[0] ?? "") ? lines.shift() : undefined;
      const parts = [
        greeting,
        lines.join("\n").trim(),
        valueLine,
        hints.cta ?? "Would a 15-minute walkthrough next week be useful?",
      ].filter(Boolean);
      return parts.join(greeting ? "\n\n" : " ");
    }
    case "expand":
      return [tighten(source), valueLine, "Here's what that means in practice: clearer data, fewer guesses, and better decisions every day."].join("\n\n");
    case "follow-up":
      return [
        "Hi there,",
        `Following up on my last note about ${product}. ${valueLine}`,
        "Happy to share a short overview or set up a quick call — whichever is easier for you.",
        "Best,",
      ].join("\n\n");
    case "social-content":
      return [
        `${sentences(tighten(source || instruction))[0] ?? `Meet ${product}.`}`,
        valueLine,
        "What would you do with better data about your recovery?",
        `#${product.replace(/\s+/g, "")} #Wellness #Recovery`,
      ].join("\n\n");
    default: {
      const subject = source || instruction || "your request";
      return `Here's a starting point for ${hints.company ?? "your team"}:\n\n- ${tighten(subject)}\n- ${valueLine}\n- Next step: align on the audience, then draft two variants to test.`;
    }
  }
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/** Build a plausible value that satisfies a (simple) JSON Schema. */
export function sampleFromSchema(schema: JsonSchema, hints: Record<string, string>, key: string): unknown {
  const type = schema.type;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (type === "object" || schema.properties) {
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    const out: Record<string, unknown> = {};
    for (const [prop, propSchema] of Object.entries(properties)) {
      out[prop] = sampleFromSchema(propSchema, hints, prop);
    }
    return out;
  }
  if (type === "array") {
    const items = (schema.items ?? { type: "string" }) as JsonSchema;
    const min = typeof schema.minItems === "number" ? schema.minItems : 3;
    const count = Math.max(min, Math.min(3, typeof schema.maxItems === "number" ? schema.maxItems : 3));
    return Array.from({ length: count }, (_, i) => sampleFromSchema(items, hints, `${key} ${i + 1}`));
  }
  if (type === "number" || type === "integer") return 1;
  if (type === "boolean") return true;
  const product = hints.product ?? hints.company ?? "the product";
  const label = humanize(key);
  return `${label} for ${product}`;
}

function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
