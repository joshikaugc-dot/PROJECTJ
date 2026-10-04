import { defineSkill, option, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

const FOCUS: Record<string, string> = {
  general: "clarity, persuasion, specificity and a clear call to action",
  clarity: "clarity — simpler sentences, one idea per sentence, no ambiguity",
  persuasion: "persuasion — lead with the reader's benefit, add credible specificity, and build momentum toward the ask",
  conversion: "conversion — a sharp value proposition in the first two lines, reduced friction, and a single, specific, low-effort call to action",
  hook: "the hook — the first line must stop the scroll; make it specific, surprising or tension-building without clickbait",
};

export const improveCopy = defineSkill<string>({
  id: "improve-copy",
  name: "Improve Copy",
  description: "Optimizes clarity, persuasion, specificity and CTA.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Improve the user's copy like a senior conversion copywriter.
- Keep the author's intent and the facts; do not add claims the context does not support.
- Keep it in the brand voice.
- Keep the length similar unless the copy is bloated.
- Keep the same format (email stays an email, post stays a post).`,
  requiredContext: ["brand.voice"],
  optionalContext: ["customers", "products", "goals", "brand.positioning"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: true,
  maxTokens: 1500,
  buildPrompt: (input) => {
    const focus = FOCUS[option(input.options, "focus", "general")] ?? FOCUS.general;
    return `Improve this copy. Focus on ${focus}.\n${textBlock(input.text)}${instructionBlock(input.instruction)}`;
  },
});
