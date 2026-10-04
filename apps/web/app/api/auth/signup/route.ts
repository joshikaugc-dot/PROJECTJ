import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, prisma } from "@contextos/database";
import { ApiError, handler, readJson } from "@/lib/server/errors";
import { createSession } from "@/lib/server/session";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export const POST = handler(async (request: Request) => {
  const body = schema.parse(await readJson(request));
  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw new ApiError(409, "email_taken", "An account with this email already exists.");
  }
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      preference: { create: {} },
      profile: { create: {} },
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true, next: "/onboarding" });
});
