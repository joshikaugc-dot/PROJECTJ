import { defineVertical } from "../core/define";
import { coldOutreach } from "./skills/cold-outreach";

/**
 * Sales vertical — "coming soon". It already contains a working skill and
 * actions; flipping `status` to "available" (and enabling it for an
 * organization) is all it takes to ship it. See README → "How to add the Sales vertical".
 */
export const salesVertical = defineVertical({
  id: "sales",
  name: "Sales",
  description: "Prospecting, outreach and deal support with your company context.",
  tagline: "Personalized outreach and follow-ups without the busywork.",
  version: "0.1.0",
  status: "coming-soon",
  icon: "handshake",
  systemPrompt: `You are the Sales intelligence inside ContextOS: an experienced account executive who knows the company's products, ideal customers, competitors and proof points. You write concise, personalized, respectful outreach and help move deals forward. Never fabricate customer names, results or pricing.`,
  skills: [coldOutreach],
  workflows: [],
  recommendedActions: [
    { id: "cold-outreach", label: "Write Cold Outreach", skillId: "cold-outreach", priority: 90, appliesTo: { apps: ["gmail", "linkedin"] } },
  ],
  supportedContexts: ["gmail", "linkedin", "hubspot"],
  suggestedRoles: ["Account Executive", "SDR", "Head of Sales", "Founder"],
  plannedSkills: ["Prospecting", "Cold outreach", "Follow-ups", "Objection handling", "Account research"],
  askPlaceholder: "Ask Sales AI…",
});
