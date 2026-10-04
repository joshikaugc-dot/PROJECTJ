import { defineSkill } from "../../core/define";
import {
  campaignBriefSchema,
  campaignBriefWorkflow,
  renderCampaignBrief,
  type CampaignBrief,
} from "../workflows/campaign-brief";

export const campaignIdeas = defineSkill<CampaignBrief>({
  id: "campaign-ideas",
  name: "Campaign Ideas",
  description: "Builds a campaign: idea, audience, message, channels and content concepts.",
  output: "json",
  outputSchema: campaignBriefSchema,
  systemInstructions: `You are building a marketing campaign step by step. Ground every step in the company context and goals.
Never invent statistics, customers or results; proof points must come from the context.`,
  requiredContext: ["company.description", "products", "customers", "brand.voice", "brand.positioning", "goals"],
  optionalContext: ["competitors", "campaigns", "documents"],
  preferredModel: { taskType: "structured" },
  allowedActions: ["insert", "copy"],
  requiresText: false,
  maxTokens: 1500,
  // Not used for generation (the workflow builds its own prompts) but kept so
  // the skill also works with a single-step runtime.
  buildPrompt: (input) => `Create a campaign brief. ${input.instruction ?? ""}`.trim(),
  render: renderCampaignBrief,
  extras: (c) => [
    { label: "Campaign", value: c.campaignName },
    { label: "Tagline", value: c.tagline },
  ],
  workflow: campaignBriefWorkflow,
});
