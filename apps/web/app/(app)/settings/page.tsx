import { prisma } from "@contextos/database";
import { PageHeader } from "@/components/page-header";
import { ExtensionCard, PrivacyForm, ProfileForm } from "@/components/settings-forms";
import { requirePageAuth } from "@/lib/server/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requirePageAuth();
  const [preference, tokens] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
    prisma.apiToken.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const p = user.profile;
  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user.email}`} />
      <div className="flex flex-col gap-4">
        <ProfileForm
          initial={{
            name: user.name,
            jobTitle: p?.jobTitle ?? "",
            department: p?.department ?? "",
            seniority: p?.seniority ?? "",
            responsibilities: p?.responsibilities ?? "",
            writingPreferences: p?.writingPreferences ?? "",
          }}
        />
        <PrivacyForm
          historyEnabled={preference?.historyEnabled ?? true}
          includePageContext={preference?.includePageContext ?? false}
        />
        <ExtensionCard
          tokens={tokens.map((t) => ({
            id: t.id,
            prefix: t.prefix,
            createdAt: t.createdAt.toISOString(),
            lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </>
  );
}
