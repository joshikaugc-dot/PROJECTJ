import { z } from "zod";
import {
  objectStep,
  priorResults,
  transformStep,
  type WorkflowDefinition,
  type WorkflowState,
} from "@contextos/workflows";
import type { SkillInput } from "../../core/types";

/**
 * Campaign Brief workflow — eight small, reusable steps instead of one giant
 * prompt. Each generation step sees the context plus the previous steps'
 * structured results, so the reasoning builds up like a strategist's would.
 */

const goalSchema = z.object({
  objective: z.string(),
  successMetric: z.string(),
  constraints: z.array(z.string()).max(4),
});
const audienceSchema = z.object({
  primaryAudience: z.string(),
  insight: z.string().describe("A non-obvious truth about this audience"),
  painPoints: z.array(z.string()).max(4),
});
const positioningSchema = z.object({
  positioningStatement: z.string(),
  differentiators: z.array(z.string()).max(4),
  proofPoints: z.array(z.string()).max(4).describe("Only facts supported by the context"),
});
const messageSchema = z.object({
  campaignName: z.string(),
  bigIdea: z.string(),
  coreMessage: z.string(),
  tagline: z.string(),
});
const channelsSchema = z.object({
  channels: z
    .array(z.object({ channel: z.string(), role: z.string(), tactic: z.string() }))
    .min(2)
    .max(5),
  contentConcepts: z
    .array(z.object({ title: z.string(), format: z.string(), channel: z.string(), description: z.string() }))
    .min(2)
    .max(6),
});

export const campaignBriefSchema = z.object({
  campaignName: z.string(),
  objective: z.string(),
  successMetric: z.string(),
  audience: audienceSchema,
  positioning: positioningSchema,
  bigIdea: z.string(),
  coreMessage: z.string(),
  tagline: z.string(),
  channels: channelsSchema.shape.channels,
  contentConcepts: channelsSchema.shape.contentConcepts,
});
export type CampaignBrief = z.infer<typeof campaignBriefSchema>;

function brief(state: WorkflowState<SkillInput>): string {
  const { text, instruction } = state.input;
  const parts = [
    instruction ? `Campaign request: ${instruction}` : undefined,
    text ? `Notes from the user:\n<text>\n${text}\n</text>` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : "Campaign request: propose the most valuable campaign for the current marketing goals.";
}

function stepPrompt(state: WorkflowState<SkillInput>, task: string, prior: string[]): string {
  const previous = priorResults(state as WorkflowState<unknown>, prior);
  return [state.shared.contextText, brief(state), previous && `Work so far:\n${previous}`, task]
    .filter(Boolean)
    .join("\n\n");
}

export const campaignBriefWorkflow: WorkflowDefinition<SkillInput, CampaignBrief> = {
  id: "marketing.campaign-brief",
  name: "Campaign Brief",
  description:
    "Load context → analyze goal → identify audience → position → message → channels → structured campaign.",
  steps: [
    transformStep("load-company-context", "Load company context", (state) => ({
      characters: state.shared.contextText.length,
    })),
    transformStep("load-vertical-context", "Load marketing vertical context", (state) => ({
      systemPromptCharacters: state.shared.system.length,
    })),
    objectStep({
      id: "goal",
      name: "Analyze goal",
      schema: goalSchema,
      prompt: (s) =>
        stepPrompt(s, "Step 1 — Define the campaign objective and how success is measured, grounded in the company's goals.", []),
    }),
    objectStep({
      id: "audience",
      name: "Identify target customer",
      schema: audienceSchema,
      prompt: (s) =>
        stepPrompt(s, "Step 2 — Choose the primary audience for this objective and articulate a sharp insight about them.", ["goal"]),
    }),
    objectStep({
      id: "positioning",
      name: "Determine positioning",
      schema: positioningSchema,
      prompt: (s) =>
        stepPrompt(s, "Step 3 — Position the product for this audience against the alternatives they consider.", ["goal", "audience"]),
    }),
    objectStep({
      id: "message",
      name: "Generate message",
      schema: messageSchema,
      prompt: (s) =>
        stepPrompt(s, "Step 4 — Create the campaign's big idea, core message and tagline in the brand voice.", ["goal", "audience", "positioning"]),
    }),
    objectStep({
      id: "channels",
      name: "Create channel recommendations",
      schema: channelsSchema,
      prompt: (s) =>
        stepPrompt(s, "Step 5 — Recommend channels (with each channel's role) and concrete content concepts.", ["audience", "message"]),
    }),
    transformStep("assemble", "Return structured campaign", (state) => {
      const r = state.results as {
        goal: z.infer<typeof goalSchema>;
        audience: z.infer<typeof audienceSchema>;
        positioning: z.infer<typeof positioningSchema>;
        message: z.infer<typeof messageSchema>;
        channels: z.infer<typeof channelsSchema>;
      };
      const campaign: CampaignBrief = {
        campaignName: r.message.campaignName,
        objective: r.goal.objective,
        successMetric: r.goal.successMetric,
        audience: r.audience,
        positioning: r.positioning,
        bigIdea: r.message.bigIdea,
        coreMessage: r.message.coreMessage,
        tagline: r.message.tagline,
        channels: r.channels.channels,
        contentConcepts: r.channels.contentConcepts,
      };
      return campaignBriefSchema.parse(campaign);
    }),
  ],
  output: (state) => state.results.assemble as CampaignBrief,
};

export function renderCampaignBrief(c: CampaignBrief): string {
  const lines = [
    `Campaign: ${c.campaignName}`,
    `Tagline: ${c.tagline}`,
    "",
    `Objective: ${c.objective}`,
    `Success metric: ${c.successMetric}`,
    "",
    `Audience: ${c.audience.primaryAudience}`,
    `Insight: ${c.audience.insight}`,
    "",
    `Big idea: ${c.bigIdea}`,
    `Core message: ${c.coreMessage}`,
    `Positioning: ${c.positioning.positioningStatement}`,
    ...(c.positioning.proofPoints.length ? ["Proof points:", ...c.positioning.proofPoints.map((p) => `- ${p}`)] : []),
    "",
    "Channels:",
    ...c.channels.map((ch) => `- ${ch.channel}: ${ch.role} — ${ch.tactic}`),
    "",
    "Content concepts:",
    ...c.contentConcepts.map((cc) => `- ${cc.title} (${cc.format}, ${cc.channel}): ${cc.description}`),
  ];
  return lines.join("\n");
}
