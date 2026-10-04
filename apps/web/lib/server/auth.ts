import { redirect } from "next/navigation";
import { hashToken, prisma } from "@contextos/database";
import { ApiError } from "./errors";
import { sessionUserId } from "./session";

export interface AuthContext {
  userId: string;
  organizationId: string;
  via: "session" | "token";
}

/** The user's active organization (falls back to their first membership). */
export async function activeOrganizationId(userId: string): Promise<string | null> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (profile?.activeOrganizationId) {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: profile.activeOrganizationId, userId } },
    });
    if (member) return member.organizationId;
  }
  const first = await prisma.organizationMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  return first?.organizationId ?? null;
}

async function userIdFromBearer(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) return null;
  const token = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(match[1]) } });
  if (!token || token.revokedAt) throw new ApiError(401, "invalid_token", "This ContextOS token is invalid or was revoked. Reconnect the extension.");
  // Avoid a write on every request: only touch lastUsedAt every 5 minutes.
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  }
  return token.userId;
}

/** Authenticate an API request by bearer token (extension) or session cookie (web). */
export async function authenticate(request: Request, options: { requireOrg?: boolean } = {}): Promise<AuthContext> {
  const requireOrg = options.requireOrg ?? true;
  const bearerUser = await userIdFromBearer(request);
  const userId = bearerUser ?? (await sessionUserId());
  if (!userId) throw new ApiError(401, "unauthenticated", "Sign in to ContextOS to continue.");
  const organizationId = await activeOrganizationId(userId);
  if (!organizationId && requireOrg) {
    throw new ApiError(409, "no_organization", "Finish onboarding in the ContextOS web app first.");
  }
  return { userId, organizationId: organizationId ?? "", via: bearerUser ? "token" : "session" };
}

/** For server components: the signed-in user + org, or a redirect. */
export async function requirePageAuth(options: { allowNoOrg?: boolean } = {}) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user) redirect("/login");
  const organizationId = await activeOrganizationId(userId);
  if (!organizationId && !options.allowNoOrg) redirect("/onboarding");
  const organization = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId } })
    : null;
  return { user, organization };
}
