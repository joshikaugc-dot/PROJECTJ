import { createModelRouterFromEnv, type ModelRouter } from "@contextos/ai";
import { ContextEngine } from "@contextos/context";
import { PrismaContextStore, prisma, syncVerticalCatalog } from "@contextos/database";
import { BUILT_IN_VERTICALS, createDefaultRegistry, type VerticalRegistry } from "@contextos/verticals";

/**
 * Process-wide platform services. Everything product-specific (verticals,
 * providers, context rules) is plugged in here and nowhere else.
 */
interface Platform {
  registry: VerticalRegistry;
  router: ModelRouter;
  store: PrismaContextStore;
  contextEngine: ContextEngine;
  catalogSynced: Promise<void> | null;
}

const globalForPlatform = globalThis as unknown as { __contextosPlatform?: Platform };

export function platform(): Platform {
  if (!globalForPlatform.__contextosPlatform) {
    const store = new PrismaContextStore(prisma);
    globalForPlatform.__contextosPlatform = {
      registry: createDefaultRegistry(),
      router: createModelRouterFromEnv(process.env),
      store,
      contextEngine: new ContextEngine(store),
      catalogSynced: null,
    };
  }
  return globalForPlatform.__contextosPlatform;
}

/** Make sure every code-defined vertical has a catalog row (cheap, once per process). */
export function ensureVerticalCatalog(): Promise<void> {
  const p = platform();
  p.catalogSynced ??= syncVerticalCatalog(prisma, BUILT_IN_VERTICALS).catch((error) => {
    p.catalogSynced = null;
    throw error;
  });
  return p.catalogSynced;
}
