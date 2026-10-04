import { defineSkill, option, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const expand = defineSkill<string>({
  id: "expand",
  name: "Expand",
  description: "Develops rough text into stronger, fuller marketing copy.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Develop the user's text into stronger marketing copy.
- Add substance from the context (product capabilities, audience pain points, positioning) — never invented facts or statistics.
- Keep the brand voice. Aim for roughly 2× the original length unless the format calls for less.`,
  requiredContext: ["brand.voice", "products"],
  optionalContext: ["customers", "brand.positioning", "goals", "content-examples"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: true,
  maxTokens: 2000,
  buildPrompt: (input) =>
    option(input.options, "mode", "expand") === "continue"
      ? `Continue writing from where this text ends. Return only the new continuation (do not repeat the existing text):\n${textBlock(input.text)}${instructionBlock(input.instruction)}`
      : `Expand this into stronger marketing copy:\n${textBlock(input.text)}${instructionBlock(input.instruction)}`,
});
