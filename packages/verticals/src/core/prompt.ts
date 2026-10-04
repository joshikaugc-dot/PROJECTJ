import { PRODUCT, type AppContext } from "@contextos/shared";
import type { AnySkill, SkillInput, SkillRunContext, VerticalDefinition } from "./types";

/** Platform-level rules shared by every vertical. */
export const PLATFORM_SYSTEM_PROMPT = `You are ${PRODUCT.name}, a specialized AI assistant embedded directly inside the apps people already use.
You already know the user's company, role and situation from the <context> provided — never ask them to explain it, and never mention that you were given context.

Rules:
- Return only the deliverable. No preamble ("Here's…", "Sure!"), no explanations, no closing remarks, no surrounding quotes.
- Never invent facts, statistics, customer names, quotes, prices or claims that are not supported by the context or the user's text.
- Preserve names, dates, links and concrete details from the user's text unless asked to change them.
- Write in the language of the user's text.`;

const APP_FORMAT: Record<string, string> = {
  gmail:
    "The result will be inserted into a Gmail message. Use plain text with short paragraphs separated by blank lines. No markdown (no **, #, or bullet symbols other than simple hyphens).",
  linkedin:
    "The result will be inserted into LinkedIn. Use plain text with line breaks for readability. No markdown formatting.",
  "google-docs":
    "The result will be inserted into a Google Doc. Plain text; simple headings and hyphen bullets are fine. No markdown symbols like ** or #.",
  notion: "The result will be inserted into Notion. Plain text with simple hyphen bullets is fine.",
  hubspot: "The result will be inserted into HubSpot. Plain text, concise.",
};

export function appFormatInstruction(app: AppContext): string {
  return (
    APP_FORMAT[app.appId] ??
    "The result will be inserted into a text field on a web page. Use plain text without markdown formatting."
  );
}

function roleGuidance(ctx: SkillRunContext): string | undefined {
  const role = ctx.user?.role;
  if (!role) return undefined;
  return `The user is a ${role}${ctx.user?.department ? ` in ${ctx.user.department}` : ""}. Calibrate depth and framing for someone in that role.`;
}

export interface BuiltPrompt {
  system: string;
  prompt: string;
  contextText: string;
}

/** Assemble platform → vertical → skill instructions plus the user prompt. */
export function buildSkillPrompt(
  vertical: VerticalDefinition,
  skill: AnySkill,
  input: SkillInput,
  ctx: SkillRunContext,
): BuiltPrompt {
  const system = [
    PLATFORM_SYSTEM_PROMPT,
    vertical.systemPrompt,
    `## Current skill: ${skill.name}\n${skill.systemInstructions}`,
    roleGuidance(ctx),
    skill.output === "text" ? `## Output format\n${appFormatInstruction(ctx.appContext)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  const contextText = `<context>\n${ctx.context.promptText}\n</context>`;
  const prompt = `${contextText}\n\n${skill.buildPrompt(input, ctx)}`;
  return { system, prompt, contextText };
}

/* Helpers for skill authors ---------------------------------------- */

export function textBlock(text: string): string {
  return `<text>\n${text}\n</text>`;
}

export function instructionBlock(instruction?: string): string {
  return instruction?.trim() ? `\n<instruction>\n${instruction.trim()}\n</instruction>` : "";
}

/** Strip the wrappers models sometimes add around a plain-text deliverable. */
export function cleanTextOutput(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fence?.[1]) text = fence[1].trim();
  text = text.replace(/^(?:sure[,!]?\s*)?here(?:'s| is)[^\n]*:\s*\n+/i, "");
  if (/^".*"$/s.test(text) && !text.slice(1, -1).includes('"')) text = text.slice(1, -1);
  text = text.replace(/<\/?text>/g, "");
  return text.trim();
}
