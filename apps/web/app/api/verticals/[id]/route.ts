import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, setVerticalEnabled } from "@contextos/database";
import { authenticate } from "@/lib/server/auth";
import { ApiError, handler, readJson } from "@/lib/server/errors";
import { ensureVerticalCatalog, platform } from "@/lib/server/platform";

const schema = z.object({
  enabled: z.boolean().optional(),
  active: z.literal(true).optional(),
});

export const PATCH = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await authenticate(request);
  const { id } = await params;
  const body = schema.parse(await readJson(request));
  const vertical = platform().registry.get(id);
  if (!vertical) throw new ApiError(404, "unknown_vertical", `Unknown vertical ${id}`);
  if (vertical.status !== "available") {
    throw new ApiError(409, "coming_soon", `${vertical.name} is coming soon.`);
  }
  await ensureVerticalCatalog();

  if (body.enabled !== undefined) {
    await setVerticalEnabled(prisma, {
      organizationId: auth.organizationId,
      userId: auth.userId,
      verticalId: id,
      enabled: body.enabled,
    });
  }
  if (body.active || body.enabled) {
    await prisma.userProfile.update({ where: { userId: auth.userId }, data: { activeVerticalId: id } });
  }
  return NextResponse.json({ ok: true });
});
