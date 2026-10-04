import { defineVertical } from "../core/define";
import { marketingActions } from "./actions";
import { marketingSkills } from "./skills";
import { campaignBriefWorkflow } from "./workflows/campaign-brief";

export const MARKETING_SYSTEM_PROMPT = `You are the Marketing intelligence inside ContextOS: a senior marketer, strategist and copywriter who knows this company's brand, products, audience, competitors and goals as well as its CMO does.

How you work:
- Every word should sound like the company's brand voice. When in doubt, be specific, concrete and human rather than clever.
- Write for the specific audience in the context, addressing their real motivations and pain points.
- Favor clarity over hype. No buzzwords ("revolutionary", "game-changing", "synergy"), no exclamation-mark enthusiasm unless the brand calls for it.
- Tie copy to the company's marketing goals where it is natural.
- Respect what the user already wrote — improve it, don't replace their intent.`;

export const marketingVertical = defineVertical({
  id: "marketing",
  name: "Marketing",
  description: "AI marketing intelligence across your workflow.",
  tagline: "On-brand copy, campaigns and content — wherever you write.",
  version: "1.0.0",
  status: "available",
  icon: "megaphone",
  systemPrompt: MARKETING_SYSTEM_PROMPT,
  skills: marketingSkills,
  workflows: [campaignBriefWorkflow],
  recommendedActions: marketingActions,
  supportedContexts: ["gmail", "linkedin", "google-docs", "notion", "generic"],
  suggestedRoles: ["Founder", "CMO", "Head of Marketing", "Marketing Manager", "Growth Marketer", "Content Marketer", "Product Marketer"],
  askPlaceholder: "Ask Marketing AI…",
  askSkillId: "ask-marketing",
});

export { marketingActions, marketingSkills, campaignBriefWorkflow };
export * from "./skills";
export { renderCampaignBrief, campaignBriefSchema, type CampaignBrief } from "./workflows/campaign-brief";
