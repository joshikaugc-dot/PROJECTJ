import { ArrowRight, Workflow } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contextos/ui";
import { PageHeader } from "@/components/page-header";
import { requirePageAuth } from "@/lib/server/auth";
import { platform } from "@/lib/server/platform";

export const metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const { user, organization } = await requirePageAuth();
  const { registry, store } = platform();
  const userContext = await store.getUserContext(user.id, organization!.id);
  const verticals = (userContext?.enabledVerticals ?? []).map((id) => registry.get(id)).filter((v) => v && v.status === "available");

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Multi-step workflows chain small, reusable steps instead of one giant prompt. Every skill runs through the same workflow engine."
      />
      <div className="flex flex-col gap-4">
        {verticals.flatMap((v) =>
          v!.workflows.map((wf) => (
            <Card key={wf.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="size-4" /> {wf.name} <Badge variant="secondary">{v!.name}</Badge>
                </CardTitle>
                <p className="text-muted-foreground">{wf.description}</p>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-wrap items-center gap-2">
                  {wf.steps.map((step, i) => (
                    <li key={step.id} className="flex items-center gap-2">
                      <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs">
                        <span className="mr-1.5 text-muted-foreground">{i + 1}</span>{step.name}
                      </span>
                      {i < wf.steps.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">
                  Used by: {v!.skills.filter((s) => s.workflow?.id === wf.id).map((s) => s.name).join(", ") || "—"}
                </p>
              </CardContent>
            </Card>
          )),
        )}
        <Card>
          <CardHeader>
            <CardTitle>Single-step skills</CardTitle>
            <p className="text-muted-foreground">These skills run as one focused generation step with routing by task type.</p>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {verticals.flatMap((v) =>
              v!.skills
                .filter((s) => !s.workflow)
                .map((s) => (
                  <div key={`${v!.id}-${s.id}`} className="rounded-md border border-border px-3 py-2">
                    <div className="text-[13px] font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Task type: {s.preferredModel.taskType} · Context: {s.requiredContext.join(", ") || "minimal"}</div>
                  </div>
                )),
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
