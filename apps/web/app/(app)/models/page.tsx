import { DEFAULT_ROUTING } from "@contextos/ai";
import { prisma } from "@contextos/database";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contextos/ui";
import { PageHeader } from "@/components/page-header";
import { ProviderSelect } from "@/components/provider-select";
import { requirePageAuth } from "@/lib/server/auth";
import { platform } from "@/lib/server/platform";

export const metadata = { title: "AI Models" };

export default async function ModelsPage() {
  const { user } = await requirePageAuth();
  const { router } = platform();
  const providers = router.listProviders();
  const preference = await prisma.userPreference.findUnique({ where: { userId: user.id } });
  const configured = providers.filter((p) => p.configured).map((p) => p.id);

  return (
    <>
      <PageHeader
        title="AI Models"
        description="ContextOS is model-agnostic. Skills declare a task type; the router picks the provider and model."
      />
      <Card className="mb-4">
        <CardHeader><CardTitle>Preferred model</CardTitle></CardHeader>
        <CardContent><ProviderSelect value={preference?.preferredProvider ?? "auto"} configured={configured} /></CardContent>
      </Card>
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {providers.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {p.displayName}
                {p.configured ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">No API key</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div>Fast: <span className="font-mono text-foreground">{p.models.fast}</span></div>
              <div>Balanced: <span className="font-mono text-foreground">{p.models.balanced}</span></div>
              <div>Powerful: <span className="font-mono text-foreground">{p.models.powerful}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!router.hasLiveProvider() && (
        <Card className="mb-4 border-amber-300/60 bg-amber-50/60">
          <CardContent className="p-5 text-[13px]">
            No provider key is configured, so the <b>offline demo model</b> answers (rule-based, not real AI). Set <code className="font-mono">ANTHROPIC_API_KEY</code> (or <code className="font-mono">OPENAI_API_KEY</code> / <code className="font-mono">GEMINI_API_KEY</code>) in <code className="font-mono">apps/web/.env.local</code> and restart.
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Routing (Auto)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="py-1.5 font-medium">Task type</th><th className="py-1.5 font-medium">Preference order</th></tr>
            </thead>
            <tbody>
              {Object.entries(DEFAULT_ROUTING).map(([task, candidates]) => (
                <tr key={task} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{task}</td>
                  <td className="py-2 text-muted-foreground">{candidates.map((c) => `${c.provider} (${c.tier})`).join(" → ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
