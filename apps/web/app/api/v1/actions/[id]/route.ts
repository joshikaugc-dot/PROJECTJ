import { NextResponse } from "next/server";
import { prisma } from "@contextos/database";
import { executedRequestSchema } from "@contextos/shared";
import { authenticate } from "@/lib/server/auth";
import { ApiError, handler, readJson } from "@/lib/server/errors";
import { markExecuted } from "@/lib/server/orchestrator";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (request: Request, { params }: Params) => {
  const auth = await authenticate(request);
  const { id } = await params;
  const action = await prisma.aIAction.findFirst({
    where: { id, userId: auth.userId, organizationId: auth.organizationId },
  });
  if (!action) throw new ApiError(404, "not_found", "Action not found");
  return NextResponse.json(action);
});

/** The client reports how the result was applied (replace / insert / copy). */
export const POST = handler(async (request: Request, { params }: Params) => {
  const auth = await authenticate(request);
  const { id } = await params;
  const body = executedRequestSchema.parse(await readJson(request));
  await markExecuted(auth, id, body.type);
  return NextResponse.json({ ok: true });
});
