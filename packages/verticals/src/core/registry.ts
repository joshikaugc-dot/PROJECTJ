import type { ActionDefinition, AnySkill, VerticalDefinition } from "./types";

export class VerticalValidationError extends Error {
  constructor(verticalId: string, problems: string[]) {
    super(`Invalid vertical "${verticalId}": ${problems.join("; ")}`);
    this.name = "VerticalValidationError";
  }
}

/** Checks a vertical is internally consistent before it is registered. */
export function validateVertical(vertical: VerticalDefinition): string[] {
  const problems: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(vertical.id)) problems.push("id must be kebab-case");
  const skillIds = new Set<string>();
  for (const skill of vertical.skills) {
    if (skillIds.has(skill.id)) problems.push(`duplicate skill id ${skill.id}`);
    skillIds.add(skill.id);
    if (skill.output === "json" && !skill.render) {
      problems.push(`json skill ${skill.id} needs a render() function`);
    }
  }
  const actionIds = new Set<string>();
  for (const action of vertical.recommendedActions) {
    if (actionIds.has(action.id)) problems.push(`duplicate action id ${action.id}`);
    actionIds.add(action.id);
    if (!skillIds.has(action.skillId)) {
      problems.push(`action ${action.id} references unknown skill ${action.skillId}`);
    }
  }
  if (vertical.status === "available" && vertical.skills.length === 0) {
    problems.push("available verticals need at least one skill");
  }
  if (vertical.askSkillId && !skillIds.has(vertical.askSkillId)) {
    problems.push(`askSkillId ${vertical.askSkillId} is not a skill of this vertical`);
  }
  return problems;
}

/**
 * The catalog of verticals the platform knows about. The core platform only
 * talks to verticals through this registry — adding a vertical means
 * registering a definition, never editing platform code.
 */
export class VerticalRegistry {
  private readonly verticals = new Map<string, VerticalDefinition>();

  register(vertical: VerticalDefinition): this {
    const problems = validateVertical(vertical);
    if (problems.length > 0) throw new VerticalValidationError(vertical.id, problems);
    if (this.verticals.has(vertical.id)) {
      throw new VerticalValidationError(vertical.id, ["already registered"]);
    }
    this.verticals.set(vertical.id, vertical);
    return this;
  }

  get(id: string): VerticalDefinition | undefined {
    return this.verticals.get(id);
  }

  require(id: string): VerticalDefinition {
    const vertical = this.get(id);
    if (!vertical) throw new Error(`Unknown vertical: ${id}`);
    return vertical;
  }

  list(): VerticalDefinition[] {
    return [...this.verticals.values()];
  }

  available(): VerticalDefinition[] {
    return this.list().filter((v) => v.status === "available");
  }

  getSkill(verticalId: string, skillId: string): AnySkill | undefined {
    return this.get(verticalId)?.skills.find((s) => s.id === skillId);
  }

  getAction(verticalId: string, actionId: string): ActionDefinition | undefined {
    return this.get(verticalId)?.recommendedActions.find((a) => a.id === actionId);
  }

  /**
   * Pick the vertical to use: the requested one if enabled, then the user's
   * active one, then the first enabled available vertical.
   */
  resolveActive(enabledIds: string[], requested?: string | null, active?: string | null) {
    const usable = (id?: string | null) =>
      id && enabledIds.includes(id) && this.get(id)?.status === "available" ? this.get(id) : undefined;
    return (
      usable(requested) ??
      usable(active) ??
      enabledIds.map((id) => usable(id)).find((v): v is VerticalDefinition => Boolean(v))
    );
  }
}
