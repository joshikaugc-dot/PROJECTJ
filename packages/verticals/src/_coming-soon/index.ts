import { defineVertical } from "../core/define";
import type { VerticalDefinition } from "../core/types";

/** Lightweight manifests for verticals on the roadmap. */
function comingSoon(id: string, name: string, description: string, plannedSkills: string[], icon: string): VerticalDefinition {
  return defineVertical({
    id,
    name,
    description,
    version: "0.0.0",
    status: "coming-soon",
    icon,
    systemPrompt: `You are the ${name} intelligence inside ContextOS.`,
    skills: [],
    workflows: [],
    recommendedActions: [],
    plannedSkills,
  });
}

export const realEstateVertical = comingSoon("real-estate", "Real Estate", "Listings, client updates and market summaries.", ["Listing descriptions", "Client updates", "Market summaries"], "home");
export const consultingVertical = comingSoon("consulting", "Consulting", "Proposals, executive summaries and client deliverables.", ["Proposals", "Executive summaries", "Workshop plans"], "briefcase");
export const operationsVertical = comingSoon("operations", "Operations", "SOPs, status updates and process documentation.", ["SOPs", "Status updates", "Process docs"], "settings");
