import { z } from "zod";

/**
 * Identifies which application the user is working in. Adapters produce one of
 * the known ids; anything else is reported as "generic".
 */
export const KNOWN_APP_IDS = [
  "gmail",
  "linkedin",
  "google-docs",
  "notion",
  "hubspot",
  "generic",
] as const;
export type KnownAppId = (typeof KNOWN_APP_IDS)[number];

export const ACTIVE_ELEMENT_TYPES = [
  "textarea",
  "input",
  "contenteditable",
  "document",
  "none",
] as const;
export type ActiveElementType = (typeof ACTIVE_ELEMENT_TYPES)[number];

/**
 * A "surface" is the kind of thing the user is writing inside an app, e.g. an
 * email compose window vs. a reply vs. a LinkedIn comment. Verticals use it to
 * recommend better actions. Free-form string so adapters can add new ones.
 */
export const COMMON_SURFACES = [
  "email-compose",
  "email-reply",
  "post-composer",
  "comment",
  "message",
  "document",
  "crm-note",
  "form-field",
  "page",
] as const;

export const appContextSchema = z.object({
  /** Stable adapter id, e.g. "gmail". */
  appId: z.string().min(1).max(64),
  /** Human readable app name, e.g. "Gmail". */
  appName: z.string().min(1).max(120),
  domain: z.string().max(255).default(""),
  pageTitle: z.string().max(500).default(""),
  /** Origin + pathname only. Query strings and fragments are stripped for privacy. */
  pageUrl: z.string().max(2000).default(""),
  selectedText: z.string().max(20_000).optional(),
  /**
   * Surrounding context (e.g. the email thread being replied to). Only sent
   * when the action asks for it or the user enables page context.
   */
  nearbyText: z.string().max(8_000).optional(),
  activeElementType: z.enum(ACTIVE_ELEMENT_TYPES).default("none"),
  /** Content of the focused editable field (capped). */
  fieldValue: z.string().max(20_000).optional(),
  surface: z.string().max(64).optional(),
  metadata: z
    .record(z.string(), z.union([z.string().max(1000), z.number(), z.boolean()]))
    .default({}),
});

export type AppContext = z.infer<typeof appContextSchema>;
export type AppContextInput = z.input<typeof appContextSchema>;

/** Strip query + hash so tokens, ids and search terms never leave the browser. */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export function hasSelection(ctx: Pick<AppContext, "selectedText">): boolean {
  return Boolean(ctx.selectedText && ctx.selectedText.trim().length > 0);
}

export function isEditable(ctx: Pick<AppContext, "activeElementType">): boolean {
  return (
    ctx.activeElementType === "textarea" ||
    ctx.activeElementType === "input" ||
    ctx.activeElementType === "contenteditable"
  );
}

/** The text an action should operate on: the selection, falling back to the field. */
export function primaryText(ctx: Pick<AppContext, "selectedText" | "fieldValue">): string {
  const selected = ctx.selectedText?.trim();
  if (selected) return selected;
  return ctx.fieldValue?.trim() ?? "";
}
