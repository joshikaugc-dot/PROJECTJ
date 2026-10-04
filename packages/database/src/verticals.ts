import type { VerticalDefinition } from "@contextos/verticals";
import type { PrismaClient } from "@prisma/client";

/** Mirror code-defined verticals into the catalog table so enablement rows can reference them. */
export async function syncVerticalCatalog(db: PrismaClient, verticals: VerticalDefinition[]): Promise<void> {
  for (const v of verticals) {
    const data = {
      name: v.name,
      description: v.description,
      version: v.version,
      status: v.status === "available" ? ("AVAILABLE" as const) : ("COMING_SOON" as const),
    };
    await db.vertical.upsert({ where: { id: v.id }, create: { id: v.id, ...data }, update: data });
  }
}
