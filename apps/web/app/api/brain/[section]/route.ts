import { NextResponse } from "next/server";
import { getBrain, prisma, saveBrainSection } from "@contextos/database";
import { BRAIN_SECTIONS, type BrainSection } from "@contextos/shared";
import { authenticate } from "@/lib/server/auth";
import { ApiError, handler, readJson } from "@/lib/server/errors";

type Params = { params: Promise<{ section: string }> };

function parseSection(section: string): BrainSection {
  if (!(BRAIN_SECTIONS as string[]).includes(section)) {
    throw new ApiError(404, "unknown_section", `Unknown Company Brain section "${section}"`);
  }
  return section as BrainSection;
}

export const GET = handler(async (request: Request, { params }: Params) => {
  const auth = await authenticate(request);
  const section = parseSection((await params).section);
  const brain = await getBrain(prisma, auth.organizationId);
  return NextResponse.json({ [section]: brain[section] });
});

export const PUT = handler(async (request: Request, { params }: Params) => {
  const auth = await authenticate(request);
  const section = parseSection((await params).section);
  await saveBrainSection(prisma, auth.organizationId, section, await readJson(request));
  const brain = await getBrain(prisma, auth.organizationId);
  return NextResponse.json({ ok: true, [section]: brain[section] });
});
