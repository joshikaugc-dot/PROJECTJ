import { NextResponse } from "next/server";
import { authenticate } from "@/lib/server/auth";
import { handler, readJson } from "@/lib/server/errors";
import { runAction } from "@/lib/server/orchestrator";

// Multi-step workflows can take a while with real models.
export const maxDuration = 120;

export const POST = handler(async (request: Request) => {
  const auth = await authenticate(request);
  return NextResponse.json(await runAction(auth, await readJson(request)));
});
