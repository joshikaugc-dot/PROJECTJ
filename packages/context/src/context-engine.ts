import {
  truncate,
  type AppContext,
  type CompanyContext,
  type ContextBlock,
  type ContextKey,
  type RelevantContext,
  type UserContext,
} from "@contextos/shared";
import { KeywordRetriever } from "./retriever";
import type {
  ContextBudget,
  ContextRequest,
  ContextStore,
  KnowledgeRetriever,
} from "./types";

export const DEFAULT_BUDGET: ContextBudget = { maxChars: 7000, maxDocuments: 3 };

/** Lower number = kept first when the budget is exceeded. */
const PRIORITY: Record<ContextKey, number> = {
  "company.basics": 0,
  "brand.voice": 1,
  "user.role": 2,
  "app.metadata": 3,
  products: 4,
  customers: 5,
  "app.nearby": 6,
  "brand.positioning": 7,
  "company.description": 8,
  goals: 9,
  competitors: 10,
  "user.preferences": 11,
  campaigns: 12,
  "content-examples": 13,
  documents: 14,
};

export interface SelectionInput {
  company: CompanyContext;
  user: UserContext | null;
  request: ContextRequest;
  retriever?: KnowledgeRetriever;
  budget?: ContextBudget;
}

function mentions(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  const escaped = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`, "i").test(haystack);
}

function bullet(items: (string | null | undefined)[]): string {
  return items.filter((i): i is string => Boolean(i && i.trim())).map((i) => `- ${i}`).join("\n");
}

function appLabel(app: AppContext): string {
  return `${app.appName} Context`;
}

/**
 * Pure selection logic: given everything we know, pick only what this task
 * needs. Each block records *why* it was included so the user can inspect it.
 */
export function selectRelevantContext(input: SelectionInput): RelevantContext {
  const { company, user, request } = input;
  const retriever = input.retriever ?? new KeywordRetriever();
  const budget = input.budget ?? DEFAULT_BUDGET;
  const required = new Set(request.task.requiredContext);
  const optional = new Set(request.task.optionalContext ?? []);
  const wants = (key: ContextKey) => required.has(key) || optional.has(key);
  const app = request.appContext;
  const workingText = [request.task.text, request.task.instruction].filter(Boolean).join("\n");
  const blocks: ContextBlock[] = [];

  // Company identity is always included: it is tiny and anchors every answer.
  blocks.push({
    key: "company.basics",
    label: company.company.name,
    content: bullet([
      `Company: ${company.company.name}`,
      company.company.industry ? `Industry: ${company.company.industry}` : null,
      company.company.website ? `Website: ${company.company.website}` : null,
    ]),
    reason: "Identifies your company",
  });

  if (wants("company.description") && company.company.description) {
    blocks.push({
      key: "company.description",
      label: "Company Overview",
      content: company.company.description,
      reason: required.has("company.description")
        ? "This skill needs to know what the company does"
        : "Useful background for this task",
    });
  }

  // Products: those mentioned in the text, otherwise the primary product when needed.
  const mentionedProducts = company.products.filter((p) => mentions(workingText, p.name));
  const products =
    mentionedProducts.length > 0
      ? mentionedProducts
      : required.has("products")
        ? company.products.filter((p) => p.isPrimary).slice(0, 1).concat(
            company.products.some((p) => p.isPrimary) ? [] : company.products.slice(0, 1),
          )
        : [];
  if (products.length > 0 && (wants("products") || mentionedProducts.length > 0)) {
    blocks.push({
      key: "products",
      label: products.length === 1 ? `Product: ${products[0]!.name}` : "Products",
      content: products
        .map((p) =>
          bullet([
            `${p.name}${p.description ? ` — ${p.description}` : ""}`,
            p.features.length ? `Key features: ${p.features.join("; ")}` : null,
            p.pricing ? `Pricing: ${p.pricing}` : null,
          ]),
        )
        .join("\n"),
      reason:
        mentionedProducts.length > 0
          ? "Mentioned in your text"
          : "Primary product, needed for this task",
    });
  }

  // Customers / audience.
  if (company.customers.length > 0) {
    const mentioned = company.customers.filter((c) => mentions(workingText, c.name));
    const segments = mentioned.length > 0 ? mentioned : required.has("customers") ? company.customers : [];
    if (segments.length > 0) {
      blocks.push({
        key: "customers",
        label: "Audience",
        content: segments
          .slice(0, 4)
          .map((c) =>
            bullet([
              `${c.name}${c.description ? `: ${c.description}` : ""}`,
              c.painPoints.length ? `Pain points: ${c.painPoints.join("; ")}` : null,
            ]),
          )
          .join("\n"),
        reason: mentioned.length > 0 ? "Segment mentioned in your text" : "Who this copy is for",
      });
    }
  }

  if (company.brand && wants("brand.voice")) {
    const brand = company.brand;
    blocks.push({
      key: "brand.voice",
      label: "Brand Voice",
      content: bullet([
        brand.voiceAttributes.length ? `Voice: ${brand.voiceAttributes.join(", ")}` : null,
        brand.voiceDescription,
        brand.doList.length ? `Do: ${brand.doList.join("; ")}` : null,
        brand.dontList.length ? `Don't: ${brand.dontList.join("; ")}` : null,
      ]),
      reason: "Keeps output on-brand",
    });
  }

  if (company.brand && wants("brand.positioning") && (company.brand.positioning || company.brand.tagline)) {
    blocks.push({
      key: "brand.positioning",
      label: "Positioning",
      content: bullet([
        company.brand.positioning,
        company.brand.tagline ? `Tagline: ${company.brand.tagline}` : null,
      ]),
      reason: "How the company wants to be perceived",
    });
  }

  // Competitors: when required, or when one is named in the text.
  const namedCompetitors = company.competitors.filter((c) => mentions(workingText, c.name));
  const competitors = required.has("competitors") ? company.competitors : namedCompetitors;
  if (competitors.length > 0) {
    blocks.push({
      key: "competitors",
      label: "Competitors",
      content: competitors
        .map((c) =>
          bullet([
            `${c.name}${c.positioning ? `: ${c.positioning}` : ""}`,
            c.differentiators ? `How we differ: ${c.differentiators}` : null,
          ]),
        )
        .join("\n"),
      reason: namedCompetitors.length > 0 ? "Competitor mentioned in your text" : "Needed for this task",
    });
  }

  if (wants("goals")) {
    const goals = company.goals.filter((g) => !g.verticalId || g.verticalId === request.vertical.id);
    if (goals.length > 0) {
      blocks.push({
        key: "goals",
        label: `${request.vertical.name} Goals`,
        content: bullet(
          goals.map(
            (g) =>
              `${g.title}${g.description ? ` — ${g.description}` : ""}${g.metric ? ` (metric: ${g.metric})` : ""}${g.timeframe ? ` [${g.timeframe}]` : ""}`,
          ),
        ),
        reason: "Aligns output with current goals",
      });
    }
  }

  // Knowledge (documents, campaigns, examples) via the retriever.
  const knowledgeKinds: { key: ContextKey; kind: string }[] = [
    { key: "campaigns", kind: "CAMPAIGN" },
    { key: "content-examples", kind: "CONTENT_EXAMPLE" },
    { key: "documents", kind: "DOCUMENT" },
  ];
  let docsUsed = 0;
  for (const { key, kind } of knowledgeKinds) {
    if (!wants(key) || docsUsed >= budget.maxDocuments) continue;
    const pool = company.knowledge.filter(
      (k) =>
        (k.kind === kind || (kind === "DOCUMENT" && (k.kind === "GUIDELINE" || k.kind === "NOTE"))) &&
        (!k.verticalId || k.verticalId === request.vertical.id),
    );
    const query = [workingText, request.task.skillId.replace(/-/g, " "), app.surface ?? ""].join(" ");
    let hits = retriever.retrieve(query, pool, budget.maxDocuments - docsUsed);
    if (hits.length === 0 && required.has(key)) {
      hits = pool.slice(0, 1).map((record) => ({ record, score: 0, matchedTerms: [] }));
    }
    for (const hit of hits) {
      docsUsed++;
      blocks.push({
        key,
        label: hit.record.title,
        content: truncate(hit.record.content, 1500),
        reason: hit.matchedTerms.length
          ? `Matches: ${hit.matchedTerms.slice(0, 4).join(", ")}`
          : "Reference material for this skill",
      });
    }
  }

  if (user?.role) {
    blocks.push({
      key: "user.role",
      label: "Your Role",
      content: bullet([
        `Role: ${user.role}`,
        user.department ? `Department: ${user.department}` : null,
        user.seniority ? `Seniority: ${user.seniority}` : null,
        user.responsibilities ? `Responsibilities: ${user.responsibilities}` : null,
      ]),
      reason: "Tailors output to how you work",
    });
  }
  if (user?.writingPreferences && (wants("user.preferences") || wants("brand.voice"))) {
    blocks.push({
      key: "user.preferences",
      label: "Writing Preferences",
      content: user.writingPreferences,
      reason: "Your personal writing preferences",
    });
  }

  // App context: a small description of where the user is.
  const meta = Object.entries(app.metadata ?? {})
    .filter(([, v]) => v !== "" && v !== undefined)
    .map(([k, v]) => `${k}: ${String(v)}`);
  blocks.push({
    key: "app.metadata",
    label: appLabel(app),
    content: bullet([
      `App: ${app.appName}${app.surface ? ` (${app.surface})` : ""}`,
      app.pageTitle ? `Page title: ${truncate(app.pageTitle, 120)}` : null,
      ...meta.slice(0, 6),
    ]),
    reason: "Where you are working",
  });

  // Surrounding page text is only used when the action needs it or the user opted in.
  if (
    app.nearbyText &&
    (required.has("app.nearby") || (optional.has("app.nearby") && request.includePageContext))
  ) {
    blocks.push({
      key: "app.nearby",
      label: app.appId === "gmail" ? "Email Thread" : "Page Context",
      content: truncate(app.nearbyText, 3000),
      reason: required.has("app.nearby")
        ? "This action works from the surrounding conversation"
        : "You enabled page context",
    });
  }

  return finalize(applyBudget(blocks, budget));
}

function applyBudget(blocks: ContextBlock[], budget: ContextBudget): ContextBlock[] {
  const sorted = [...blocks].sort((a, b) => PRIORITY[a.key] - PRIORITY[b.key]);
  const kept: ContextBlock[] = [];
  let used = 0;
  for (const block of sorted) {
    const size = block.content.length + block.label.length + 8;
    if (used + size > budget.maxChars) {
      const remaining = budget.maxChars - used - block.label.length - 8;
      if (remaining > 200) {
        kept.push({ ...block, content: truncate(block.content, remaining) });
        used = budget.maxChars;
      }
      continue;
    }
    kept.push(block);
    used += size;
  }
  return kept;
}

function finalize(blocks: ContextBlock[]): RelevantContext {
  const promptText = blocks.map((b) => `### ${b.label}\n${b.content}`).join("\n\n");
  return { blocks, promptText };
}

/** Labels for the "Using:" indicator. */
export function contextLabels(vertical: { name: string }, context: RelevantContext): string[] {
  const labels = [vertical.name, ...context.blocks.map((b) => b.label)];
  return [...new Set(labels)];
}

/**
 * Stateful service wrapper used by the API: loads data via the store and
 * applies selection rules.
 */
export class ContextEngine {
  constructor(
    private readonly store: ContextStore,
    private readonly retriever: KnowledgeRetriever = new KeywordRetriever(),
    private readonly budget: ContextBudget = DEFAULT_BUDGET,
  ) {}

  async getRelevantContext(
    request: ContextRequest,
  ): Promise<RelevantContext & { company: CompanyContext; user: UserContext | null }> {
    const [company, user] = await Promise.all([
      this.store.getCompanyContext(request.organizationId),
      this.store.getUserContext(request.userId, request.organizationId),
    ]);
    if (!company) throw new Error(`No company context for organization ${request.organizationId}`);
    const selected = selectRelevantContext({
      company,
      user,
      request,
      retriever: this.retriever,
      budget: this.budget,
    });
    return { ...selected, company, user };
  }
}
