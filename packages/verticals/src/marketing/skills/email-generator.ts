import { z } from "zod";
import { defineSkill } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const emailOutputSchema = z.object({
  subject: z.string().describe("Subject line, under 60 characters"),
  previewText: z.string().describe("Inbox preview text, under 90 characters"),
  body: z.string().describe("Plain-text email body including greeting and sign-off"),
  cta: z.string().describe("The single call to action, as it appears in the body"),
});
export type EmailOutput = z.infer<typeof emailOutputSchema>;

export const emailGenerator = defineSkill<EmailOutput>({
  id: "email-generator",
  name: "Email Generator",
  description: "Generates a complete marketing email: subject, preview, body and CTA.",
  output: "json",
  outputSchema: emailOutputSchema,
  systemInstructions: `Write a marketing email.
- Subject: specific, under 60 characters, no clickbait or ALL CAPS.
- Preview text: complements (not repeats) the subject.
- Body: plain text, short paragraphs, written for the audience in the context, in the brand voice. One clear CTA.
- If the user has drafted text, use it as the brief and keep its key points.`,
  requiredContext: ["brand.voice", "products", "customers"],
  optionalContext: ["goals", "campaigns", "brand.positioning", "app.metadata"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: false,
  maxTokens: 2000,
  buildPrompt: (input) =>
    `Write a marketing email.${input.text ? `\nBrief / draft from the user:\n${textBlock(input.text)}` : ""}${instructionBlock(input.instruction)}`,
  render: (output) => output.body,
  extras: (output) => [
    { label: "Subject", value: output.subject },
    { label: "Preview text", value: output.previewText },
  ],
});
