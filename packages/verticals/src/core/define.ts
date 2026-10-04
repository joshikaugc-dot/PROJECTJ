import { z } from "zod";
import { skillInputSchema, type SkillDefinition, type VerticalDefinition } from "./types";

/**
 * Identity helpers that give skill/vertical authors full type inference.
 * Third-party packages (a future marketplace) would use exactly these.
 */
export function defineSkill<TOutput>(
  skill: Omit<SkillDefinition<TOutput>, "inputSchema"> & {
    inputSchema?: SkillDefinition<TOutput>["inputSchema"];
  },
): SkillDefinition<TOutput> {
  return { inputSchema: skillInputSchema, ...skill };
}

export function defineVertical(vertical: VerticalDefinition): VerticalDefinition {
  return vertical;
}

/** Plain-text output schema used by most writing skills. */
export const textOutput = z.string();

/** Read a string option with a default. */
export function option(options: Record<string, string>, key: string, fallback: string): string {
  const value = options[key];
  return value && value.trim() ? value : fallback;
}
