import { Logo } from "@/components/logo";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { requirePageAuth } from "@/lib/server/auth";
import { platform } from "@/lib/server/platform";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const { user, organization } = await requirePageAuth({ allowNoOrg: true });
  const verticals = platform()
    .registry.list()
    .map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      status: v.status,
      suggestedRoles: v.suggestedRoles ?? [],
    }));

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-muted/60 to-background px-4 py-12">
      <div className="mb-8"><Logo className="text-lg" /></div>
      <OnboardingWizard userName={user.name} email={user.email} verticals={verticals} hasOrganization={Boolean(organization)} />
    </main>
  );
}
