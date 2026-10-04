import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/home", "/brain", "/verticals", "/workflows", "/history", "/integrations", "/models", "/settings", "/onboarding", "/extension"];

/** Cheap gate: bounce visitors without a session cookie. Real verification happens server-side. */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.get("ctxos_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
