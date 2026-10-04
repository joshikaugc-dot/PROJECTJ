/**
 * Product identity lives in exactly one place so the temporary name
 * ("ContextOS") can be replaced without a codebase-wide search.
 */
export const PRODUCT = {
  name: "ContextOS",
  shortName: "ContextOS",
  tagline: "Specialized AI that follows you across your workflow.",
  description:
    "Company-aware, role-aware AI that works inside the apps you already use.",
  /** Prefix used for DOM ids, storage keys and message types. */
  slug: "contextos",
} as const;

export type ProductInfo = typeof PRODUCT;
