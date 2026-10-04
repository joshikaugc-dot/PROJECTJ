import { z } from "zod";
import { defineSkill } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const subjectLinesSchema = z.object({
  subjectLines: z.array(z.string()).min(3).max(8),
});

export const subjectLines = defineSkill<z.infer<typeof subjectLinesSchema>>({
  id: "subject-lines",
  name: "Subject Lines",
  description: "Suggests subject lines for the email you are writing.",
  output: "json",
  outputSchema: subjectLinesSchema,
  systemInstructions: `Write 5 distinct subject lines for this email, each under 60 characters, in the brand voice.
Vary the angle: benefit-led, curiosity, specificity, social/evidence, direct. No clickbait, no ALL CAPS, at most one emoji across all lines.`,
  requiredContext: ["brand.voice", "customers"],
  optionalContext: ["products", "app.metadata"],
  preferredModel: { taskType: "fast-rewrite" },
  allowedActions: ["copy", "insert"],
  requiresText: true,
  maxTokens: 600,
  buildPrompt: (input) => `Email:\n${textBlock(input.text)}${instructionBlock(input.instruction)}`,
  render: (output) => output.subjectLines.join("\n"),
});
