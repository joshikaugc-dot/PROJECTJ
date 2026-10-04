import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const rewriteBrandVoice = defineSkill<string>({
  id: "rewrite-brand-voice",
  name: "Rewrite in Brand Voice",
  description: "Rewrites the selected text so it sounds unmistakably like your brand.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Rewrite the user's text in the company's brand voice.
- Apply every voice attribute and the do/don't rules from the Brand Voice context.
- Keep the original intent, structure (greeting, sign-off, paragraphs), facts and length roughly the same (within ±25%).
- Speak to the audience described in the context; connect to the product only where the text already points to it.
- Remove clichés, filler and hype words. Prefer concrete, specific language.`,
  requiredContext: ["brand.voice", "customers"],
  optionalContext: ["products", "brand.positioning", "user.preferences"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: true,
  maxTokens: 1500,
  buildPrompt: (input) =>
    `Rewrite this text in our brand voice:\n${textBlock(input.text)}${instructionBlock(input.instruction)}`,
});
