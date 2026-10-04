import { z } from "zod";
import { defineSkill } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const contentIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        angle: z.string().describe("Why this resonates with the audience"),
        format: z.string().describe("e.g. LinkedIn post, blog, short video, email"),
        channel: z.string(),
      }),
    )
    .min(3)
    .max(10),
});
export type ContentIdeas = z.infer<typeof contentIdeasSchema>;

export const contentIdeas = defineSkill<ContentIdeas>({
  id: "content-ideas",
  name: "Content Ideas",
  description: "Generates content ideas based on company, product, audience and goals.",
  output: "json",
  outputSchema: contentIdeasSchema,
  systemInstructions: `Generate 6 specific content ideas tailored to the company, its product, its audience and its current marketing goals.
Each idea needs a concrete title, the audience angle, a format and a channel. Avoid generic ideas that any company could publish.`,
  requiredContext: ["company.description", "products", "customers", "goals"],
  optionalContext: ["brand.positioning", "competitors", "content-examples", "campaigns"],
  preferredModel: { taskType: "structured" },
  allowedActions: ["insert", "copy"],
  requiresText: false,
  maxTokens: 2000,
  buildPrompt: (input) =>
    `Generate content ideas.${input.text ? `\nTopic or draft to build on:\n${textBlock(input.text)}` : ""}${instructionBlock(input.instruction)}`,
  render: (output) =>
    output.ideas
      .map((idea, i) => `${i + 1}. ${idea.title}\n   ${idea.format} · ${idea.channel}\n   ${idea.angle}`)
      .join("\n\n"),
});
