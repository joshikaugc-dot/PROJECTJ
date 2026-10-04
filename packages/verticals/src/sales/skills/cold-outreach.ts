import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

/**
 * A complete, working skill shipped with the (not yet enabled) Sales vertical
 * to show that a new vertical needs no platform changes — only definitions.
 */
export const coldOutreach = defineSkill<string>({
  id: "cold-outreach",
  name: "Cold Outreach",
  description: "Writes a personalized first-touch email to a prospect.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Write a short (70–110 words) first-touch email to a prospect.
- Open with something specific to the prospect or their company, if the text provides it.
- One relevant problem we solve for their segment; one proof point from the context only.
- A low-friction ask. No attachments, no "hope this finds you well".`,
  requiredContext: ["products", "customers", "brand.voice"],
  optionalContext: ["competitors", "app.nearby"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: false,
  maxTokens: 800,
  buildPrompt: (input) =>
    `Write a cold outreach email.${input.text ? `\nProspect notes / draft:\n${textBlock(input.text)}` : ""}${instructionBlock(input.instruction)}`,
});
