import type { GenerateResult, ModelRouter, ProviderPreference } from "@contextos/ai";
import { contextLabels, selectRelevantContext } from "@contextos/context";
import { Prisma, prisma } from "@contextos/database";
import {
  appContextSchema,
  preview,
  primaryText,
  recommendRequestSchema,
  runRequestSchema,
  truncate,
  type AppContext,
  type CompanyContext,
  type RecommendResponse,
  type RunResponse,
  type UserContext,
  type VerticalSummary,
} from "@contextos/shared";
import {
  executeSkill,
  getRecommendedActions,
  type AnySkill,
  type VerticalDefinition,
} from "@contextos/verticals";
import type { WorkflowRuntime } from "@contextos/workflows";
import type { AuthContext } from "./auth";
import { ApiError } from "./errors";
import { platform } from "./platform";

/**
 * The orchestrator is the only place where the six layers meet:
 *   App context → Company/User context → Vertical/Skill → Workflow → Model → Execution (client).
 * It contains no vertical- or app-specific logic.
 */

export function summarizeVertical(v: VerticalDefinition): VerticalSummary {
  return { id: v.id, name: v.name, description: v.description, status: v.status };
}

interface Loaded {
  company: CompanyContext;
  user: UserContext;
  vertical: VerticalDefinition;
  enabled: VerticalDefinition[];
}

async function load(auth: AuthContext, requestedVertical?: string): Promise<Loaded> {
  const { registry, store } = platform();
  const [company, user] = await Promise.all([
    store.getCompanyContext(auth.organizationId),
    store.getUserContext(auth.userId, auth.organizationId),
  ]);
  if (!company || !user) throw new ApiError(404, "not_found", "Organization or user not found");
  const vertical = registry.resolveActive(user.enabledVerticals, requestedVertical, user.activeVertical);
  if (!vertical) {
    throw new ApiError(409, "no_vertical", "No vertical is enabled. Enable Marketing in ContextOS → Verticals.");
  }
  const enabled = user.enabledVerticals
    .map((id) => registry.get(id))
    .filter((v): v is VerticalDefinition => Boolean(v && v.status === "available"));
  return { company, user, vertical, enabled };
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

export async function recommend(auth: AuthContext, body: unknown): Promise<RecommendResponse> {
  const req = recommendRequestSchema.parse(body);
  const { company, user, vertical, enabled } = await load(auth, req.verticalId);
  const scored = getRecommendedActions({ vertical, appContext: req.appContext, userContext: user, limit: 6 });

  // Preview the context the top action would use — shown before anything is sent to a model.
  const top = scored[0] ? vertical.skills.find((s) => s.id === scored[0]!.action.skillId) : undefined;
  const previewContext = selectRelevantContext({
    company,
    user,
    request: {
      organizationId: auth.organizationId,
      userId: auth.userId,
      vertical,
      appContext: req.appContext,
      task: {
        skillId: top?.id ?? "preview",
        requiredContext: top?.requiredContext ?? ["brand.voice"],
        optionalContext: top?.optionalContext,
        text: primaryText(req.appContext),
      },
    },
  });

  return {
    vertical: summarizeVertical(vertical),
    enabledVerticals: enabled.map(summarizeVertical),
    actions: scored.map(({ action, reasons }) => ({
      id: action.id,
      verticalId: vertical.id,
      skillId: action.skillId,
      label: action.label,
      description: action.description,
      icon: action.icon,
      reason: reasons.join(", ") || undefined,
    })),
    askPlaceholder: vertical.askPlaceholder ?? `Ask ${vertical.name} AI…`,
    contextPreview: contextLabels(vertical, previewContext),
  };
}

/* ------------------------------------------------------------------ */
/* Running a skill                                                     */
/* ------------------------------------------------------------------ */

function demoHints(company: CompanyContext, skill: AnySkill, vertical: VerticalDefinition): Record<string, string> {
  const product = company.products.find((p) => p.isPrimary) ?? company.products[0];
  const firstSentence = product?.description?.match(/^[^.]+/)?.[0]?.trim();
  return {
    skillId: skill.id,
    verticalId: vertical.id,
    company: company.company.name,
    ...(product ? { product: product.name } : {}),
    ...(firstSentence
      ? {
          productSummary: /^(a|an|the)\s/i.test(firstSentence)
            ? `is ${firstSentence.charAt(0).toLowerCase()}${firstSentence.slice(1)}`
            : firstSentence,
        }
      : {}),
  };
}

/** A WorkflowRuntime backed by the model router that records every model call. */
function createRuntime(
  router: ModelRouter,
  options: { preferredProvider: ProviderPreference; metadata: Record<string, string> },
) {
  const calls: GenerateResult[] = [];
  const runtime: WorkflowRuntime = {
    async generateText(req) {
      const result = await router.generate({
        systemPrompt: req.system,
        messages: [...(req.history ?? []), { role: "user", content: req.prompt }],
        taskType: req.taskType,
        maxTokens: req.maxTokens,
        preferredProvider: options.preferredProvider,
        metadata: options.metadata,
      });
      calls.push(result);
      return result.text;
    },
    async generateObject(req, schema) {
      const { object, result } = await router.generateObject(
        {
          systemPrompt: req.system,
          messages: [...(req.history ?? []), { role: "user", content: req.prompt }],
          taskType: req.taskType,
          maxTokens: req.maxTokens,
          preferredProvider: options.preferredProvider,
          metadata: options.metadata,
        },
        schema,
      );
      calls.push(result);
      return object;
    },
  };
  return { runtime, calls };
}

const PROVIDERS = new Set(["auto", "anthropic", "openai", "gemini"]);

export async function runAction(auth: AuthContext, body: unknown): Promise<RunResponse> {
  const req = runRequestSchema.parse(body);
  const { router } = platform();
  const { company, user, vertical } = await load(auth, req.verticalId);
  const preference = await prisma.userPreference.findUnique({ where: { userId: auth.userId } });

  const action = req.actionId ? vertical.recommendedActions.find((a) => a.id === req.actionId) : undefined;
  if (req.actionId && !action) throw new ApiError(404, "unknown_action", `Unknown action ${req.actionId}`);
  const skillId = action?.skillId ?? req.skillId ?? vertical.askSkillId;
  const skill = vertical.skills.find((s) => s.id === skillId);
  if (!skill) throw new ApiError(404, "unknown_skill", `${vertical.name} has no skill "${skillId}"`);

  const appContext: AppContext = appContextSchema.parse(req.appContext);
  const text = primaryText(appContext);
  const isRefinement = Boolean(req.previousOutput && req.instruction);
  const includePageContext = Boolean(req.includePageContext ?? preference?.includePageContext);
  const needsNearby = skill.requiredContext.includes("app.nearby");

  const context = selectRelevantContext({
    company,
    user,
    request: {
      organizationId: auth.organizationId,
      userId: auth.userId,
      vertical,
      appContext,
      includePageContext,
      task: {
        skillId: skill.id,
        requiredContext: skill.requiredContext,
        optionalContext: skill.optionalContext,
        text,
        instruction: req.instruction,
      },
    },
  });

  const requestedProvider = req.preferredProvider ?? preference?.preferredProvider ?? "auto";
  const preferredProvider = (PROVIDERS.has(requestedProvider) ? requestedProvider : "auto") as ProviderPreference;
  const { runtime, calls } = createRuntime(router, {
    preferredProvider,
    metadata: demoHints(company, skill, vertical),
  });

  const started = Date.now();
  const label = action?.label ?? (req.instruction ? truncate(req.instruction, 80) : skill.name);
  const historyEnabled = preference?.historyEnabled ?? true;

  try {
    const result = await executeSkill({
      vertical,
      skill,
      runtime,
      ctx: {
        appContext,
        user,
        companyName: company.company.name,
        verticalName: vertical.name,
        context,
      },
      input: {
        text,
        instruction: isRefinement ? undefined : req.instruction,
        options: { ...action?.options, ...req.options },
        nearbyText: needsNearby || includePageContext ? appContext.nearbyText : undefined,
      },
      refinement: isRefinement ? { previousOutput: req.previousOutput!, instruction: req.instruction! } : undefined,
    });

    const last = calls[calls.length - 1];
    const usage = calls.reduce(
      (acc, c) => ({ input: acc.input + (c.usage?.inputTokens ?? 0), output: acc.output + (c.usage?.outputTokens ?? 0) }),
      { input: 0, output: 0 },
    );
    const latencyMs = Date.now() - started;
    const labels = contextLabels(vertical, context);

    let actionRecordId: string | null = null;
    let conversationId: string | null = req.conversationId ?? null;
    if (historyEnabled) {
      if (isRefinement || skill.id === vertical.askSkillId) {
        conversationId = await recordConversation(auth, vertical, conversationId, {
          title: label,
          user: req.instruction ?? text,
          assistant: result.text,
        });
      }
      const record = await prisma.aIAction.create({
        data: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          verticalId: vertical.id,
          skillId: skill.id,
          actionId: action?.id,
          label: isRefinement ? `Refine: ${truncate(req.instruction!, 60)}` : label,
          appId: appContext.appId,
          appName: appContext.appName,
          domain: appContext.domain || null,
          surface: appContext.surface,
          instruction: req.instruction,
          inputText: text ? truncate(text, 10_000) : null,
          outputText: result.text,
          contextUsed: context.blocks.map((b) => ({ key: b.key, label: b.label, reason: b.reason })),
          structuredOutput:
            skill.output === "json" ? (result.output as Prisma.InputJsonValue) : Prisma.JsonNull,
          provider: last?.provider ?? "unknown",
          model: last?.model ?? "unknown",
          latencyMs,
          inputTokens: usage.input,
          outputTokens: usage.output,
          conversationId,
        },
      });
      actionRecordId = record.id;
    }

    return {
      actionRecordId,
      conversationId,
      output: result.text,
      structured: skill.output === "json" ? result.output : undefined,
      vertical: { id: vertical.id, name: vertical.name },
      skill: { id: skill.id, name: skill.name },
      context: { labels, blocks: context.blocks },
      provider: last?.provider ?? "unknown",
      model: last?.model ?? "unknown",
      latencyMs,
      allowedActions: skill.allowedActions,
      demoMode: last?.provider === "demo",
      workflowTrace: result.trace.map((t) => ({ stepId: t.stepId, name: t.name, durationMs: t.durationMs })),
      extras: result.extras.length ? result.extras : undefined,
    };
  } catch (error) {
    if (historyEnabled) {
      await prisma.aIAction
        .create({
          data: {
            organizationId: auth.organizationId,
            userId: auth.userId,
            verticalId: vertical.id,
            skillId: skill.id,
            actionId: action?.id,
            label,
            appId: appContext.appId,
            appName: appContext.appName,
            domain: appContext.domain || null,
            surface: appContext.surface,
            instruction: req.instruction,
            inputText: text ? truncate(text, 10_000) : null,
            provider: calls[calls.length - 1]?.provider ?? "unknown",
            model: calls[calls.length - 1]?.model ?? "unknown",
            status: "FAILED",
            error: preview((error as Error).message, 500),
            latencyMs: Date.now() - started,
          },
        })
        .catch(() => undefined);
    }
    throw error;
  }
}

async function recordConversation(
  auth: AuthContext,
  vertical: VerticalDefinition,
  conversationId: string | null,
  turn: { title: string; user: string; assistant: string },
): Promise<string> {
  let id = conversationId;
  if (id) {
    const existing = await prisma.aIConversation.findFirst({ where: { id, userId: auth.userId } });
    if (!existing) id = null;
  }
  if (!id) {
    const created = await prisma.aIConversation.create({
      data: {
        organizationId: auth.organizationId,
        userId: auth.userId,
        verticalId: vertical.id,
        title: truncate(turn.title, 120),
      },
    });
    id = created.id;
  }
  await prisma.aIMessage.createMany({
    data: [
      { conversationId: id, role: "user", content: truncate(turn.user, 10_000) },
      { conversationId: id, role: "assistant", content: turn.assistant },
    ],
  });
  await prisma.aIConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  return id;
}

/** Record that the user applied a result (replace / insert / copy). */
export async function markExecuted(auth: AuthContext, actionRecordId: string, type: string) {
  const updated = await prisma.aIAction.updateMany({
    where: { id: actionRecordId, userId: auth.userId, organizationId: auth.organizationId },
    data: { executedAs: type, executedAt: new Date() },
  });
  if (updated.count === 0) throw new ApiError(404, "not_found", "Action not found");
}
