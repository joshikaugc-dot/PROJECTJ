import { NextResponse } from "next/server";
import { prisma } from "@contextos/database";
import { authenticate } from "@/lib/server/auth";
import { handler } from "@/lib/server/errors";

export const DELETE = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await authenticate(request, { requireOrg: false });
  const { id } = await params;
  await prisma.apiToken.updateMany({
    where: { id, userId: auth.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
