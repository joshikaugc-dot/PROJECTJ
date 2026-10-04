import { defineVertical } from "../core/define";

export const financeVertical = defineVertical({
  id: "finance",
  name: "Finance",
  description: "Financial analysis, memos and KPI reviews grounded in your numbers.",
  version: "0.0.0",
  status: "coming-soon",
  icon: "landmark",
  systemPrompt: "You are the Finance intelligence inside ContextOS.",
  skills: [],
  workflows: [],
  recommendedActions: [],
  suggestedRoles: ["CFO", "Finance Analyst", "Controller", "Founder"],
  plannedSkills: ["Financial analysis", "Investment memos", "Forecast review", "KPI analysis"],
});
