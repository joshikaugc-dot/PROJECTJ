import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const askMarketing = defineSkill<string>({
  id: "ask-marketing",
  name: "Ask Marketing AI",
  description: "Free-form marketing requests that use your company context.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Answer the user's marketing request as a senior marketer who knows this company deeply.
- If they ask for copy, return only the copy.
- If they ask a question, answer directly and specifically for this company — concise, practical, no generic advice.
- If the request concerns the selected text, operate on that text.`,
  requiredContext: ["brand.voice", "customers"],
  optionalContext: [
    "company.description",
    "products",
    "brand.positioning",
    "competitors",
    "goals",
    "documents",
    "campaigns",
    "content-examples",
    "app.nearby",
  ],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: false,
  maxTokens: 2500,
  buildPrompt: (input) =>
    `${input.text ? `Selected text:\n${textBlock(input.text)}\n` : ""}${instructionBlock(input.instruction || "Improve this text.")}`,
});
