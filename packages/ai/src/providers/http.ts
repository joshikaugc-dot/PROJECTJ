import { AIProviderError, type ProviderId } from "../types";

export type FetchLike = typeof fetch;

export async function postJson(
  provider: ProviderId,
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw new AIProviderError(
      `Network error calling ${provider}: ${(error as Error).message}`,
      provider,
      undefined,
      true,
    );
  }

  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep raw text
    }
    throw new AIProviderError(
      `${provider} returned ${response.status}: ${message}`,
      provider,
      response.status,
      response.status === 429 || response.status >= 500,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AIProviderError(`${provider} returned invalid JSON`, provider, response.status);
  }
}

/** Instruction appended to the system prompt when a JSON schema is requested. */
export function jsonInstruction(schema: Record<string, unknown>): string {
  return [
    "Respond with a single JSON object and nothing else — no prose, no markdown fences.",
    "The JSON must validate against this JSON Schema:",
    JSON.stringify(schema),
  ].join("\n");
}

export function joinSystem(...parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join("\n\n");
}
