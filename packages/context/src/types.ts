import type {
  AppContext,
  CompanyContext,
  ContextKey,
  KnowledgeRecord,
  UserContext,
} from "@contextos/shared";

/**
 * Storage boundary for the context engine. The Prisma implementation lives in
 * @contextos/database; tests use in-memory stores.
 */
export interface ContextStore {
  getCompanyContext(organizationId: string): Promise<CompanyContext | null>;
  getUserContext(userId: string, organizationId: string): Promise<UserContext | null>;
}

/**
 * Chooses which knowledge documents are relevant to a task. The MVP ships a
 * keyword retriever; an embeddings/vector retriever can implement the same
 * interface later without touching callers.
 */
export interface KnowledgeRetriever {
  readonly id: string;
  retrieve(query: string, documents: KnowledgeRecord[], limit: number): ScoredKnowledge[];
}

export interface ScoredKnowledge {
  record: KnowledgeRecord;
  score: number;
  matchedTerms: string[];
}

export interface ContextTask {
  skillId: string;
  requiredContext: ContextKey[];
  optionalContext?: ContextKey[];
  /** The text being worked on (selection or field). */
  text?: string;
  instruction?: string;
}

export interface ContextRequest {
  organizationId: string;
  userId: string;
  vertical: { id: string; name: string };
  task: ContextTask;
  appContext: AppContext;
  /** User opted in to sending surrounding page context. */
  includePageContext?: boolean;
}

export interface ContextBudget {
  /** Upper bound on characters of context placed in a prompt. */
  maxChars: number;
  maxDocuments: number;
}
