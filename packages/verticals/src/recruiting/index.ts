import { defineVertical } from "../core/define";

export const recruitingVertical = defineVertical({
  id: "recruiting",
  name: "Recruiting",
  description: "Job descriptions, candidate outreach and interview kits in your employer voice.",
  version: "0.0.0",
  status: "coming-soon",
  icon: "users",
  systemPrompt: "You are the Recruiting intelligence inside ContextOS.",
  skills: [],
  workflows: [],
  recommendedActions: [],
  suggestedRoles: ["Recruiter", "Talent Lead", "Hiring Manager", "Founder"],
  plannedSkills: ["Job descriptions", "Candidate outreach", "Interview kits", "Offer letters"],
});
