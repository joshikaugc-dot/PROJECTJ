import { NextResponse } from "next/server";
import { prisma } from "@contextos/database";
import { authenticate } from "@/lib/server/auth";
import { handler } from "@/lib/server/errors";

/** Delete all of the user's AI history in the active organization. */
export const DELETE = handler(async (request: Request) => {
  const auth = await authenticate(request);
  const where = { userId: auth.userId, organizationId: auth.organizationId };
  const [actions] = await prisma.$transaction([
    prisma.aIAction.deleteMany({ where }),
    prisma.aIConversation.deleteMany({ where }),
  ]);
  return NextResponse.json({ ok: true, deleted: actions.count });
});
