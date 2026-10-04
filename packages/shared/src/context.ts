/**
 * Shared shapes for the Company/Personal context layer. These are plain data
 * types so they can cross the network (extension <-> API) and be stored.
 */

export const CONTEXT_KEYS = [
  "company.basics",
  "company.description",
  "products",
  "customers",
  "brand.voice",
  "brand.positioning",
  "competitors",
  "goals",
  "documents",
  "campaigns",
  "content-examples",
  "user.role",
  "user.preferences",
  "app.metadata",
  "app.nearby",
] as const;
export type ContextKey = (typeof CONTEXT_KEYS)[number];

export interface CompanyBasics {
  name: string;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
}

export interface ProductRecord {
  id: string;
  name: string;
  description?: string | null;
  features: string[];
  pricing?: string | null;
  isPrimary: boolean;
}

export interface CustomerSegmentRecord {
  id: string;
  name: string;
  description?: string | null;
  painPoints: string[];
  isPrimary: boolean;
}

export interface CompetitorRecord {
  id: string;
  name: string;
  website?: string | null;
  positioning?: string | null;
  differentiators?: string | null;
}

export interface BrandRecord {
  voiceAttributes: string[];
  voiceDescription?: string | null;
  positioning?: string | null;
  tagline?: string | null;
  doList: string[];
  dontList: string[];
}

export interface GoalRecord {
  id: string;
  title: string;
  description?: string | null;
  metric?: string | null;
  timeframe?: string | null;
  verticalId?: string | null;
}

export type KnowledgeKind = "DOCUMENT" | "CAMPAIGN" | "CONTENT_EXAMPLE" | "GUIDELINE" | "NOTE";

export interface KnowledgeRecord {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  tags: string[];
  verticalId?: string | null;
}

/** Everything ContextOS knows about an organization. Never sent wholesale to a model. */
export interface CompanyContext {
  organizationId: string;
  company: CompanyBasics;
  products: ProductRecord[];
  customers: CustomerSegmentRecord[];
  competitors: CompetitorRecord[];
  brand: BrandRecord | null;
  goals: GoalRecord[];
  knowledge: KnowledgeRecord[];
}

export interface UserContext {
  userId: string;
  name: string;
  role?: string | null;
  department?: string | null;
  seniority?: string | null;
  responsibilities?: string | null;
  writingPreferences?: string | null;
  preferredProvider: string;
  enabledVerticals: string[];
  activeVertical: string | null;
}

/** One unit of context that was selected for a request — shown in the context inspector. */
export interface ContextBlock {
  key: ContextKey;
  /** Short label for the "Using:" indicator, e.g. "Brand Voice". */
  label: string;
  /** The text that is placed in the prompt. */
  content: string;
  /** Why the context engine included it. Builds user trust. */
  reason: string;
}

export interface RelevantContext {
  blocks: ContextBlock[];
  /** Rendered prompt section built from the blocks. */
  promptText: string;
}
