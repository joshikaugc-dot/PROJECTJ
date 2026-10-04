/**
 * Extract a JSON value from model output. Tolerates markdown fences and
 * leading/trailing prose, which every provider occasionally produces.
 */
export function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [trimmed, fenced?.[1]?.trim()];

  const firstBrace = trimmed.search(/[[{]/);
  if (firstBrace >= 0) {
    const open = trimmed[firstBrace];
    const close = open === "{" ? "}" : "]";
    const lastBrace = trimmed.lastIndexOf(close);
    if (lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  return undefined;
}
