import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const competitorAnalysis = defineSkill<string>({
  id: "competitor-analysis",
  name: "Competitor Analysis",
  description: "Compares your positioning against competitors and suggests counter-messaging.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Analyze the competitive situation using only the competitor information in the context and the user's text.
Structure: where each competitor wins, where we win, the gap to exploit, and 2–3 counter-messaging lines in the brand voice.
Be explicit when something is an assumption.`,
  requiredContext: ["competitors", "brand.positioning", "products"],
  optionalContext: ["customers", "documents"],
  preferredModel: { taskType: "reasoning" },
  allowedActions: ["insert", "copy"],
  requiresText: false,
  maxTokens: 2000,
  buildPrompt: (input) =>
    `Run a competitor analysis.${input.text ? `\nFocus on:\n${textBlock(input.text)}` : ""}${instructionBlock(input.instruction)}`,
});
