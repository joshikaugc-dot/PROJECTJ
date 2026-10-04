import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrganization, prisma, saveBrainSection } from "@contextos/database";
import { brainSectionSchemas, companySectionSchema } from "@contextos/shared";
import { activeOrganizationId, authenticate } from "@/lib/server/auth";
import { ApiError, handler, readJson } from "@/lib/server/errors";
import { ensureVerticalCatalog, platform } from "@/lib/server/platform";

const schema = z.object({
  organization: companySectionSchema,
  role: z.object({
    jobTitle: z.string().trim().min(1).max(120),
    department: z.string().trim().max(120).optional(),
    seniority: z.string().trim().max(120).optional(),
  }),
  verticals: z.array(z.string()).min(1),
  setup: z
    .object({
      products: brainSectionSchemas.products,
      customers: brainSectionSchemas.customers,
      brand: brainSectionSchemas.brand,
      competitors: brainSectionSchemas.competitors,
      goals: brainSectionSchemas.goals,
    })
    .partial()
    .default({}),
});

export const POST = handler(async (request: Request) => {
  const auth = await authenticate(request, { requireOrg: false });
  const body = schema.parse(await readJson(request));
  await ensureVerticalCatalog();

  const { registry } = platform();
  const verticalIds = body.verticals.filter((id) => registry.get(id)?.status === "available");
  if (verticalIds.length === 0) throw new ApiError(400, "no_vertical", "Choose at least one available vertical.");

  let organizationId = await activeOrganizationId(auth.userId);
  if (!organizationId) {
    const org = await createOrganization(prisma, {
      ownerId: auth.userId,
      name: body.organization.name,
      industry: body.organization.industry,
      website: body.organization.website,
      description: body.organization.description,
      verticalIds,
    });
    organizationId = org.id;
  } else {
    await saveBrainSection(prisma, organizationId, "company", body.organization);
    for (const verticalId of verticalIds) {
      await prisma.organizationVertical.upsert({
        where: { organizationId_verticalId: { organizationId, verticalId } },
        create: { organizationId, verticalId },
        update: { enabled: true },
      });
    }
  }

  for (const verticalId of verticalIds) {
    await prisma.userVertical.upsert({
      where: { userId_organizationId_verticalId: { userId: auth.userId, organizationId, verticalId } },
      create: { userId: auth.userId, organizationId, verticalId },
      update: { enabled: true },
    });
  }

  for (const section of ["products", "customers", "brand", "competitors", "goals"] as const) {
    const value = body.setup[section];
    if (value !== undefined) await saveBrainSection(prisma, organizationId, section, value);
  }

  await prisma.userProfile.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      ...body.role,
      activeOrganizationId: organizationId,
      activeVerticalId: verticalIds[0],
      onboardingCompleted: true,
    },
    update: {
      ...body.role,
      activeOrganizationId: organizationId,
      activeVerticalId: verticalIds[0],
      onboardingCompleted: true,
    },
  });

  return NextResponse.json({ ok: true, organizationId });
});
