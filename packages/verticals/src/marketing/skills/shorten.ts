import { defineSkill, option, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const shorten = defineSkill<string>({
  id: "shorten",
  name: "Shorten",
  description: "Makes the text more concise while keeping its meaning.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Make the text substantially shorter (aim for 40–60% of the original length) while keeping every essential point, name, date and call to action.
- Cut filler, hedging and repetition first.
- Keep the brand voice and the original format (greeting/sign-off for emails).`,
  requiredContext: [],
  optionalContext: ["brand.voice"],
  preferredModel: { taskType: "fast-rewrite" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: true,
  maxTokens: 1000,
  buildPrompt: (input) =>
    option(input.options, "mode", "concise") === "summary"
      ? `Summarize this text in a few crisp sentences or bullets:\n${textBlock(input.text)}${instructionBlock(input.instruction)}`
      : `Shorten this text:\n${textBlock(input.text)}${instructionBlock(input.instruction)}`,
});
