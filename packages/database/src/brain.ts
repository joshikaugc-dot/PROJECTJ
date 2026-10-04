import {
  brainSectionSchemas,
  type Brain,
  type BrainSection,
} from "@contextos/shared";
import type { PrismaClient } from "@prisma/client";

const EMPTY_BRAND = {
  voiceAttributes: [],
  voiceDescription: null,
  positioning: null,
  tagline: null,
  doList: [],
  dontList: [],
};

/** Load the editable Company Brain for an organization. */
export async function getBrain(db: PrismaClient, organizationId: string): Promise<Brain> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: {
      companyProfile: true,
      brandProfile: true,
      products: { orderBy: { createdAt: "asc" } },
      customerSegments: { orderBy: { createdAt: "asc" } },
      competitors: { orderBy: { createdAt: "asc" } },
      goals: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
    },
  });
  return {
    company: {
      name: org.name,
      industry: org.companyProfile?.industry ?? null,
      website: org.companyProfile?.website ?? null,
      description: org.companyProfile?.description ?? null,
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
    brand: org.brandProfile
      ? {
          voiceAttributes: org.brandProfile.voiceAttributes,
          voiceDescription: org.brandProfile.voiceDescription,
          positioning: org.brandProfile.positioning,
          tagline: org.brandProfile.tagline,
          doList: org.brandProfile.doList,
          dontList: org.brandProfile.dontList,
        }
      : EMPTY_BRAND,
    competitors: org.competitors.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      positioning: c.positioning,
      differentiators: c.differentiators,
    })),
    goals: org.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      metric: g.metric,
      timeframe: g.timeframe,
      verticalId: g.verticalId,
    })),
    documents: org.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      content: d.content,
      tags: d.tags,
      verticalId: d.verticalId,
    })),
  };
}

/**
 * Validate and save one Company Brain section. List sections are replaced
 * atomically (the editor always sends the full list).
 */
export async function saveBrainSection(
  db: PrismaClient,
  organizationId: string,
  section: BrainSection,
  raw: unknown,
): Promise<void> {
  const organization = { connect: { id: organizationId } };
  switch (section) {
    case "company": {
      const data = brainSectionSchemas.company.parse(raw);
      await db.$transaction([
        db.organization.update({ where: { id: organizationId }, data: { name: data.name } }),
        db.companyProfile.upsert({
          where: { organizationId },
          create: { organization, industry: data.industry, website: data.website, description: data.description },
          update: { industry: data.industry, website: data.website, description: data.description },
        }),
      ]);
      return;
    }
    case "brand": {
      const data = brainSectionSchemas.brand.parse(raw);
      await db.brandProfile.upsert({
        where: { organizationId },
        create: { organization, ...data },
        update: data,
      });
      return;
    }
    case "products": {
      const items = brainSectionSchemas.products.parse(raw);
      await db.$transaction([
        db.product.deleteMany({ where: { organizationId } }),
        db.product.createMany({ data: items.map(({ id: _id, ...p }) => ({ ...p, organizationId })) }),
      ]);
      return;
    }
    case "customers": {
      const items = brainSectionSchemas.customers.parse(raw);
      await db.$transaction([
        db.customerSegment.deleteMany({ where: { organizationId } }),
        db.customerSegment.createMany({ data: items.map(({ id: _id, ...c }) => ({ ...c, organizationId })) }),
      ]);
      return;
    }
    case "competitors": {
      const items = brainSectionSchemas.competitors.parse(raw);
      await db.$transaction([
        db.competitor.deleteMany({ where: { organizationId } }),
        db.competitor.createMany({ data: items.map(({ id: _id, ...c }) => ({ ...c, organizationId })) }),
      ]);
      return;
    }
    case "goals": {
      const items = brainSectionSchemas.goals.parse(raw);
      await db.$transaction([
        db.goal.deleteMany({ where: { organizationId } }),
        db.goal.createMany({ data: items.map(({ id: _id, ...g }) => ({ ...g, organizationId })) }),
      ]);
      return;
    }
    case "documents": {
      const items = brainSectionSchemas.documents.parse(raw);
      await db.$transaction([
        db.knowledgeDocument.deleteMany({ where: { organizationId } }),
        db.knowledgeDocument.createMany({ data: items.map(({ id: _id, ...d }) => ({ ...d, organizationId })) }),
      ]);
      return;
    }
  }
}
