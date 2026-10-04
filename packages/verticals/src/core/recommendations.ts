import { hasSelection, isEditable, primaryText, type AppContext, type UserContext } from "@contextos/shared";
import type { ActionDefinition, VerticalDefinition } from "./types";

export interface RecommendationInput {
  vertical: VerticalDefinition;
  appContext: AppContext;
  userContext?: Pick<UserContext, "role"> | null;
  limit?: number;
}

export interface ScoredAction {
  action: ActionDefinition;
  score: number;
  reasons: string[];
}

/**
 * Ranks a vertical's actions for the user's current situation: the app, the
 * surface they are writing in, whether text is selected, and their role.
 * Pure function — trivially unit-testable and reusable by any client.
 */
export function getRecommendedActions(input: RecommendationInput): ScoredAction[] {
  const { vertical, appContext, userContext } = input;
  const limit = input.limit ?? 6;
  const selection = hasSelection(appContext);
  const hasText = primaryText(appContext).length > 0;
  const editable = isEditable(appContext);
  const role = userContext?.role?.toLowerCase() ?? "";

  const scored: ScoredAction[] = [];
  for (const action of vertical.recommendedActions) {
    const reasons: string[] = [];
    let score = action.priority;

    if (action.requiresSelection && !selection) continue;
    if (action.requiresText && !hasText) continue;
    if (action.requiresEditable && !editable) continue;
    if (action.onlyWithoutText && hasText) continue;

    if (action.appliesTo) {
      const appMatch = action.appliesTo.apps?.includes(appContext.appId) ?? false;
      const surfaceMatch =
        (appContext.surface && action.appliesTo.surfaces?.includes(appContext.surface)) ?? false;
      if (!appMatch && !surfaceMatch) continue;
      if (appMatch) {
        score += 25;
        reasons.push(`tuned for ${appContext.appName}`);
      }
      if (surfaceMatch) {
        score += 15;
        reasons.push(`fits ${appContext.surface}`);
      }
    }

    if (selection && (action.requiresSelection || action.requiresText)) {
      score += 5;
      reasons.push("works on your selection");
    }
    if (role && action.roles?.some((r) => role.includes(r.toLowerCase()))) {
      score += 10;
      reasons.push("matches your role");
    }

    scored.push({ action, score, reasons });
  }

  // Specific actions replace the generic ones they supersede.
  const superseded = new Set(scored.flatMap((s) => s.action.supersedes ?? []));
  return scored
    .filter((s) => !superseded.has(s.action.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
