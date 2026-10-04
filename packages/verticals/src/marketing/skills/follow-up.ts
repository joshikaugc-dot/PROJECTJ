import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const followUp = defineSkill<string>({
  id: "follow-up",
  name: "Follow-Up Generator",
  description: "Writes an appropriate follow-up using the surrounding conversation.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Write a follow-up message.
- Use the earlier message/thread (in <text> or the Email Thread context) to reference what was discussed — specifically, not generically.
- Add one new piece of value (an insight, a benefit, or a useful resource from the context) rather than just "checking in".
- Short: 60–120 words. One clear, low-friction ask. Brand voice. Plain text email with greeting and sign-off.`,
  requiredContext: ["brand.voice", "app.nearby"],
  optionalContext: ["products", "customers", "goals"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["insert", "replace", "copy"],
  requiresText: true,
  maxTokens: 1000,
  buildPrompt: (input) =>
    `Write a follow-up to this message.\n${textBlock(input.text || input.nearbyText || "")}${instructionBlock(input.instruction)}`,
});
