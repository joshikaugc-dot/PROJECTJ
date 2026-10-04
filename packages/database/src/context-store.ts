import type { ContextStore } from "@contextos/context";
import type { CompanyContext, KnowledgeKind, UserContext } from "@contextos/shared";
import type { PrismaClient } from "@prisma/client";

/** Prisma-backed implementation of the context engine's storage boundary. */
export class PrismaContextStore implements ContextStore {
  constructor(private readonly db: PrismaClient) {}

  async getCompanyContext(organizationId: string): Promise<CompanyContext | null> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      include: {
        companyProfile: true,
        brandProfile: true,
        products: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        customerSegments: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        competitors: { orderBy: { createdAt: "asc" } },
        goals: { where: { status: "active" }, orderBy: { createdAt: "asc" } },
        documents: { orderBy: { updatedAt: "desc" }, take: 200 },
      },
    });
    if (!org) return null;
    return {
      organizationId: org.id,
      company: {
        name: org.name,
        industry: org.companyProfile?.industry,
        website: org.companyProfile?.website,
        description: org.companyProfile?.description,
      },
      products: org.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        features: p.features,
        pricing: p.pricing,
        isPrimary: p.isPrimary,
      })),
      customers: org.customerSegments.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        painPoints: c.painPoints,
        isPrimary: c.isPrimary,
      })),
      competitors: org.competitors.map((c) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        positioning: c.positioning,
        differentiators: c.differentiators,
      })),
      brand: org.brandProfile
        ? {
            voiceAttributes: org.brandProfile.voiceAttributes,
            voiceDescription: org.brandProfile.voiceDescription,
            positioning: org.brandProfile.positioning,
            tagline: org.brandProfile.tagline,
            doList: org.brandProfile.doList,
            dontList: org.brandProfile.dontList,
          }
        : null,
      goals: org.goals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        metric: g.metric,
        timeframe: g.timeframe,
        verticalId: g.verticalId,
      })),
      knowledge: org.documents.map((d) => ({
        id: d.id,
        kind: d.kind as KnowledgeKind,
        title: d.title,
        content: d.content,
        tags: d.tags,
        verticalId: d.verticalId,
      })),
    };
  }

  async getUserContext(userId: string, organizationId: string): Promise<UserContext | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preference: true,
        verticals: { where: { organizationId, enabled: true } },
      },
    });
    if (!user) return null;
    const orgVerticals = await this.db.organizationVertical.findMany({
      where: { organizationId, enabled: true },
      select: { verticalId: true },
    });
    const orgEnabled = new Set(orgVerticals.map((v) => v.verticalId));
    // A user's verticals are the org-installed ones they enabled (or all org ones if they never chose).
    const personal = user.verticals.map((v) => v.verticalId).filter((id) => orgEnabled.has(id));
    const enabledVerticals = personal.length > 0 ? personal : [...orgEnabled];

    return {
      userId: user.id,
      name: user.name,
      role: user.profile?.jobTitle,
      department: user.profile?.department,
      seniority: user.profile?.seniority,
      responsibilities: user.profile?.responsibilities,
      writingPreferences: user.profile?.writingPreferences,
      preferredProvider: user.preference?.preferredProvider ?? "auto",
      enabledVerticals,
      activeVertical: user.profile?.activeVerticalId ?? enabledVerticals[0] ?? null,
    };
  }
}
