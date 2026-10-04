import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@contextos/database";
import { authenticate } from "@/lib/server/auth";
import { handler, readJson } from "@/lib/server/errors";

const text = (max: number) => z.string().trim().max(max).nullish();

const schema = z.object({
  profile: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      jobTitle: text(120),
      department: text(120),
      seniority: text(120),
      responsibilities: text(1000),
      writingPreferences: text(1000),
    })
    .optional(),
  preferences: z
    .object({
      preferredProvider: z.enum(["auto", "anthropic", "openai", "gemini"]).optional(),
      historyEnabled: z.boolean().optional(),
      includePageContext: z.boolean().optional(),
    })
    .optional(),
});

export const PATCH = handler(async (request: Request) => {
  const auth = await authenticate(request, { requireOrg: false });
  const body = schema.parse(await readJson(request));
  if (body.profile) {
    const { name, ...profile } = body.profile;
    if (name) await prisma.user.update({ where: { id: auth.userId }, data: { name } });
    await prisma.userProfile.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, ...profile },
      update: profile,
    });
  }
  if (body.preferences) {
    await prisma.userPreference.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, ...body.preferences },
      update: body.preferences,
    });
  }
  return NextResponse.json({ ok: true });
});
