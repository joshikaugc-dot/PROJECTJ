import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, verifyPassword } from "@contextos/database";
import { activeOrganizationId } from "@/lib/server/auth";
import { ApiError, handler, readJson } from "@/lib/server/errors";
import { createSession } from "@/lib/server/session";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const POST = handler(async (request: Request) => {
  const body = schema.parse(await readJson(request));
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new ApiError(401, "invalid_credentials", "Incorrect email or password.");
  }
  await createSession(user.id);
  const org = await activeOrganizationId(user.id);
  return NextResponse.json({ ok: true, next: org ? "/home" : "/onboarding" });
});
