import { z } from "zod";
import { ACTIVE_ELEMENT_TYPES, type AppContext } from "./app-context";
import { EXECUTION_ACTION_TYPES, type RecommendRequest, type RunRequest } from "./api";

/**
 * Runtime validation for the API contract. Kept separate from the plain types
 * so browser bundles (the extension) don't ship zod.
 */

export const appContextSchema = z.object({
  appId: z.string().min(1).max(64),
  appName: z.string().min(1).max(120),
  domain: z.string().max(255).default(""),
  pageTitle: z.string().max(500).default(""),
  pageUrl: z.string().max(2000).default(""),
  selectedText: z.string().max(20_000).optional(),
  nearbyText: z.string().max(8_000).optional(),
  activeElementType: z.enum(ACTIVE_ELEMENT_TYPES).default("none"),
  fieldValue: z.string().max(20_000).optional(),
  surface: z.string().max(64).optional(),
  metadata: z
    .record(z.string(), z.union([z.string().max(1000), z.number(), z.boolean()]))
    .default({}),
});

export const recommendRequestSchema = z.object({
  appContext: appContextSchema,
  verticalId: z.string().optional(),
});

export const runRequestSchema = z
  .object({
    appContext: appContextSchema,
    verticalId: z.string().optional(),
    actionId: z.string().optional(),
    skillId: z.string().optional(),
    instruction: z.string().max(4000).optional(),
    options: z.record(z.string(), z.string()).optional(),
    includePageContext: z.boolean().optional(),
    previousOutput: z.string().max(20_000).optional(),
    conversationId: z.string().optional(),
    preferredProvider: z.string().optional(),
  })
  .refine((v) => v.actionId || v.skillId || v.instruction, {
    message: "One of actionId, skillId or instruction is required",
  });

export const executedRequestSchema = z.object({
  type: z.enum(EXECUTION_ACTION_TYPES),
});

// Compile-time guarantees that the schemas and the plain interfaces agree.
type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type _AppContextMatches = Assert<Same<z.output<typeof appContextSchema>, AppContext>>;
export type _RecommendMatches = Assert<Same<z.input<typeof recommendRequestSchema>["verticalId"], RecommendRequest["verticalId"]>>;
export type _RunMatches = Assert<Same<keyof z.output<typeof runRequestSchema>, keyof RunRequest>>;
