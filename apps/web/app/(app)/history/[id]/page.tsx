import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { prisma } from "@contextos/database";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contextos/ui";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { requirePageAuth } from "@/lib/server/auth";
import { executedLabel, formatDateTime } from "@/lib/format";

export const metadata = { title: "AI action" };

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, organization } = await requirePageAuth();
  const action = await prisma.aIAction.findFirst({
    where: { id, userId: user.id, organizationId: organization!.id },
    include: { conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!action) notFound();
  const context = (action.contextUsed as { label: string; reason: string }[]) ?? [];

  return (
    <>
      <Link href="/history" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> History
      </Link>
      <PageHeader
        title={action.label}
        description={`${formatDateTime(action.createdAt)} · ${action.appName}${action.surface ? ` (${action.surface})` : ""} · ${action.provider} / ${action.model} · ${(action.latencyMs / 1000).toFixed(1)}s`}
        actions={
          <>
            <Badge variant="secondary" className="capitalize">{action.verticalId}</Badge>
            {action.executedAs && <Badge>{executedLabel(action.executedAs)}</Badge>}
            {action.status === "FAILED" && <Badge variant="warning">Failed</Badge>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Input</CardTitle></CardHeader>
          <CardContent>
            {action.instruction && <p className="mb-2 text-muted-foreground">Instruction: {action.instruction}</p>}
            <pre className="whitespace-pre-wrap font-sans">{action.inputText || "—"}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Output</CardTitle>
            {action.outputText && <CopyButton text={action.outputText} />}
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans">{action.outputText ?? action.error ?? "—"}</pre>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Context used</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {context.length === 0 && <p className="text-muted-foreground">—</p>}
          {context.map((c) => (
            <div key={`${c.label}`} className="text-[13px]"><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">— {c.reason}</span></div>
          ))}
        </CardContent>
      </Card>
      {action.conversation && action.conversation.messages.length > 2 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {action.conversation.messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-muted-foreground" : ""}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.role}</div>
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
