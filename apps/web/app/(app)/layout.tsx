import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { requirePageAuth } from "@/lib/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, organization } = await requirePageAuth();
  if (!organization) redirect("/onboarding");
  return (
    <div className="flex min-h-screen">
      <Sidebar orgName={organization.name} userName={user.name} role={user.profile?.jobTitle ?? null} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
