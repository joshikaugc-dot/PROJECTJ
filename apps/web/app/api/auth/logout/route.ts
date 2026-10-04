import { NextResponse } from "next/server";
import { handler } from "@/lib/server/errors";
import { destroySession } from "@/lib/server/session";

export const POST = handler(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
