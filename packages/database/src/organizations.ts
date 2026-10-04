import { slugify } from "@contextos/shared";
import type { PrismaClient } from "@prisma/client";

export interface CreateOrganizationInput {
  ownerId: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
  verticalIds?: string[];
}

async function uniqueSlug(db: PrismaClient, name: string): Promise<string> {
  const base = slugify(name) || "org";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.organization.findUnique({ where: { slug } }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

/** Create an organization owned by a user, install verticals and make it active. */
export async function createOrganization(db: PrismaClient, input: CreateOrganizationInput) {
  const slug = await uniqueSlug(db, input.name);
  const verticalIds = input.verticalIds ?? [];
  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug,
        members: { create: { userId: input.ownerId, role: "OWNER" } },
        companyProfile: {
          create: { industry: input.industry, website: input.website, description: input.description },
        },
        verticals: { create: verticalIds.map((verticalId) => ({ verticalId })) },
      },
    });
    await tx.userProfile.upsert({
      where: { userId: input.ownerId },
      create: { userId: input.ownerId, activeOrganizationId: org.id, activeVerticalId: verticalIds[0] ?? null },
      update: { activeOrganizationId: org.id, activeVerticalId: verticalIds[0] ?? null },
    });
    return org;
  });
}

/** Enable or disable a vertical for an organization (and for the acting user). */
export async function setVerticalEnabled(
  db: PrismaClient,
  params: { organizationId: string; userId: string; verticalId: string; enabled: boolean },
) {
  const { organizationId, userId, verticalId, enabled } = params;
  await db.organizationVertical.upsert({
    where: { organizationId_verticalId: { organizationId, verticalId } },
    create: { organizationId, verticalId, enabled },
    update: { enabled },
  });
  await db.userVertical.upsert({
    where: { userId_organizationId_verticalId: { userId, organizationId, verticalId } },
    create: { userId, organizationId, verticalId, enabled },
    update: { enabled },
  });
}
