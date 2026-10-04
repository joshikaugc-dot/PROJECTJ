import { Blocks, Sparkles } from "lucide-react";
import { prisma } from "@contextos/database";
import { Badge, Card, CardContent } from "@contextos/ui";
import { PageHeader } from "@/components/page-header";
import { VerticalToggle } from "@/components/vertical-toggle";
import { requirePageAuth } from "@/lib/server/auth";
import { platform } from "@/lib/server/platform";

export const metadata = { title: "Verticals" };

export default async function VerticalsPage() {
  const { user, organization } = await requirePageAuth();
  const { registry, store } = platform();
  const userContext = await store.getUserContext(user.id, organization!.id);
  const orgRows = await prisma.organizationVertical.findMany({ where: { organizationId: organization!.id } });
  const enabled = new Set(userContext?.enabledVerticals ?? []);

  return (
    <>
      <PageHeader
        title="Verticals"
        description="Each vertical brings its own skills, workflows and recommended actions to the same extension. Enable the ones you work in."
      />
      <div className="flex flex-col gap-3">
        {registry.list().map((v) => {
          const available = v.status === "available";
          const isEnabled = enabled.has(v.id);
          const installed = orgRows.some((r) => r.verticalId === v.id && r.enabled);
          return (
            <Card key={v.id} className={available ? "" : "opacity-80"}>
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {available ? <Sparkles className="size-5" /> : <Blocks className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{v.name}</span>
                    {available ? (
                      isEnabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="secondary">Available</Badge>
                    ) : (
                      <Badge variant="secondary">Coming soon</Badge>
                    )}
                    {userContext?.activeVertical === v.id && isEnabled && <Badge>Active</Badge>}
                    {installed && !isEnabled && <Badge variant="outline">Installed for org</Badge>}
                  </div>
                  <p className="mt-1 text-muted-foreground">{v.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(available ? v.skills.map((s) => s.name) : (v.plannedSkills ?? [])).map((name) => (
                      <span key={name} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{name}</span>
                    ))}
                  </div>
                  {available && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {v.skills.length} skills · {v.workflows.length} multi-step workflow{v.workflows.length === 1 ? "" : "s"} · {v.recommendedActions.length} context-aware actions · v{v.version}
                    </p>
                  )}
                </div>
                {available && (
                  <VerticalToggle id={v.id} enabled={isEnabled} active={userContext?.activeVertical === v.id} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
