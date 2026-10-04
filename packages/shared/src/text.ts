/** Small text helpers shared by the API, the extension and the web app. */

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Single-line preview for history tables and logs. */
export function preview(text: string | null | undefined, max = 140): string {
  if (!text) return "";
  return truncate(text.replace(/\s+/g, " ").trim(), max);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lowercased word tokens (len >= 3) used by the rule-based context retriever. */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const word of text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? []) {
    tokens.add(word);
  }
  return tokens;
}
