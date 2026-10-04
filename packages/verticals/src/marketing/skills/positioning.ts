import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const positioning = defineSkill<string>({
  id: "positioning",
  name: "Positioning",
  description: "Sharpens a value proposition or positioning statement.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Write or sharpen positioning. Use the classic structure (for [audience] who [need], [product] is the [category] that [key benefit], unlike [alternative], we [differentiator]) as thinking scaffolding, but return polished, natural language.
Return: a one-sentence positioning statement, a one-line value proposition, and three supporting messages.`,
  requiredContext: ["products", "customers", "competitors", "brand.positioning"],
  optionalContext: ["brand.voice", "goals"],
  preferredModel: { taskType: "reasoning" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: false,
  maxTokens: 1200,
  buildPrompt: (input) =>
    `Sharpen our positioning.${input.text ? `\nCurrent draft:\n${textBlock(input.text)}` : ""}${instructionBlock(input.instruction)}`,
});
