import { NextResponse } from "next/server";
import { authenticate } from "@/lib/server/auth";
import { handler, readJson } from "@/lib/server/errors";
import { recommend } from "@/lib/server/orchestrator";

export const POST = handler(async (request: Request) => {
  const auth = await authenticate(request);
  return NextResponse.json(await recommend(auth, await readJson(request)));
});
