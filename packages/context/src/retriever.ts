import { tokenize, type KnowledgeRecord } from "@contextos/shared";
import type { KnowledgeRetriever, ScoredKnowledge } from "./types";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "you", "your", "our", "are", "was", "have",
  "has", "will", "from", "about", "just", "can", "not", "but", "all", "any", "out", "get",
  "they", "them", "their", "what", "when", "how", "who", "its", "it's", "into", "more",
  "hi", "hello", "thanks", "best", "regards", "wanted", "want", "make", "would", "could",
]);

function terms(text: string): Set<string> {
  const out = new Set<string>();
  for (const token of tokenize(text)) if (!STOPWORDS.has(token)) out.add(token);
  return out;
}

/**
 * Keyword-overlap retriever. Title and tag matches weigh more than body
 * matches. Deliberately simple; swap for an embedding retriever later.
 */
export class KeywordRetriever implements KnowledgeRetriever {
  readonly id = "keyword-v1";

  retrieve(query: string, documents: KnowledgeRecord[], limit: number): ScoredKnowledge[] {
    const queryTerms = terms(query);
    if (queryTerms.size === 0) return [];

    const scored = documents.map((record) => {
      const titleTerms = terms(`${record.title} ${record.tags.join(" ")}`);
      const bodyTerms = terms(record.content);
      const matched: string[] = [];
      let score = 0;
      for (const term of queryTerms) {
        if (titleTerms.has(term)) {
          score += 3;
          matched.push(term);
        } else if (bodyTerms.has(term)) {
          score += 1;
          matched.push(term);
        }
      }
      return { record, score, matchedTerms: matched };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
