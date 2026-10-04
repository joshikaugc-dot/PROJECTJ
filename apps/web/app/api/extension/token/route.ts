import { NextResponse } from "next/server";
import { generateToken, hashToken, prisma } from "@contextos/database";
import { authenticate } from "@/lib/server/auth";
import { ApiError, handler } from "@/lib/server/errors";

/**
 * Issue a token for the Chrome extension. Only callable from a signed-in web
 * session (never with another token), so a leaked token cannot mint more.
 */
export const POST = handler(async (request: Request) => {
  const auth = await authenticate(request);
  if (auth.via !== "session") throw new ApiError(403, "forbidden", "Tokens can only be created from the web app.");
  const token = generateToken("ctx");
  await prisma.apiToken.create({
    data: {
      userId: auth.userId,
      name: "Chrome extension",
      prefix: token.slice(0, 10),
      tokenHash: hashToken(token),
    },
  });
  return NextResponse.json({ token, apiUrl: process.env.CONTEXTOS_APP_URL ?? new URL(request.url).origin });
});
