import { NextResponse } from "next/server";
import { prisma } from "@contextos/database";
import { PRODUCT, type BootstrapResponse } from "@contextos/shared";
import { activeOrganizationId, authenticate } from "@/lib/server/auth";
import { handler } from "@/lib/server/errors";
import { summarizeVertical } from "@/lib/server/orchestrator";
import { platform } from "@/lib/server/platform";

/** Everything a client (extension, desktop) needs to render its signed-in state. */
export const GET = handler(async (request: Request) => {
  const auth = await authenticate(request, { requireOrg: false });
  const { registry, store } = platform();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: auth.userId },
    include: { profile: true, preference: true },
  });
  const organizationId = await activeOrganizationId(auth.userId);
  const organization = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } })
    : null;
  const userContext = organizationId ? await store.getUserContext(auth.userId, organizationId) : null;
  const enabled = (userContext?.enabledVerticals ?? [])
    .map((id) => registry.get(id))
    .filter((v) => v && v.status === "available")
    .map((v) => summarizeVertical(v!));
  const active = userContext
    ? registry.resolveActive(userContext.enabledVerticals, null, userContext.activeVertical)
    : undefined;

  const body: BootstrapResponse = {
    product: { name: PRODUCT.name },
    user: { id: user.id, name: user.name, email: user.email, role: user.profile?.jobTitle ?? null },
    organization,
    activeVertical: active ? summarizeVertical(active) : null,
    enabledVerticals: enabled,
    preferences: {
      historyEnabled: user.preference?.historyEnabled ?? true,
      includePageContext: user.preference?.includePageContext ?? false,
      preferredProvider: user.preference?.preferredProvider ?? "auto",
    },
  };
  return NextResponse.json(body);
});
