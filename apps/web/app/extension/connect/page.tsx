import { redirect } from "next/navigation";
import { ExtensionConnect } from "@/components/extension-connect";
import { Logo } from "@/components/logo";
import { activeOrganizationId } from "@/lib/server/auth";
import { sessionUserId } from "@/lib/server/session";

export const metadata = { title: "Connect extension" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ ext?: string }> }) {
  const { ext } = await searchParams;
  const extensionId = ext && /^[a-p]{32}$/.test(ext) ? ext : null;
  const userId = await sessionUserId();
  const next = `/extension/connect${extensionId ? `?ext=${extensionId}` : ""}`;
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!(await activeOrganizationId(userId))) redirect("/onboarding");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-muted/60 to-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo className="text-lg" /></div>
        <ExtensionConnect extensionId={extensionId} />
      </div>
    </main>
  );
}
