import Link from "next/link";
import { prisma } from "@contextos/database";
import { preview } from "@contextos/shared";
import { Badge, Card } from "@contextos/ui";
import { ClearHistoryButton } from "@/components/clear-history-button";
import { PageHeader } from "@/components/page-header";
import { requirePageAuth } from "@/lib/server/auth";
import { executedLabel, formatDateTime } from "@/lib/format";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const { user, organization } = await requirePageAuth();
  const [actions, preference] = await Promise.all([
    prisma.aIAction.findMany({
      where: { userId: user.id, organizationId: organization!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
  ]);
  const historyEnabled = preference?.historyEnabled ?? true;

  return (
    <>
      <PageHeader
        title="History"
        description={
          historyEnabled
            ? "Every AI action you take, across apps. Only the text tied to an action you ran is stored."
            : "History is turned off — new actions are not stored. Turn it back on in Settings."
        }
        actions={actions.length > 0 ? <ClearHistoryButton /> : undefined}
      />
      <Card className="overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Application</th>
              <th className="px-4 py-2 font-medium">Vertical</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Input</th>
              <th className="px-4 py-2 font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No AI actions yet. Press ⌘⇧K in Gmail to create one.</td>
              </tr>
            )}
            {actions.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  <Link href={`/history/${a.id}`} className="block">{formatDateTime(a.createdAt)}</Link>
                </td>
                <td className="px-4 py-2.5">{a.appName}</td>
                <td className="px-4 py-2.5 capitalize">{a.verticalId}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/history/${a.id}`} className="font-medium hover:underline">{a.label}</Link>
                  {a.status === "FAILED" && <Badge variant="warning" className="ml-2">Failed</Badge>}
                  {a.executedAs && <Badge variant="secondary" className="ml-2">{executedLabel(a.executedAs)}</Badge>}
                </td>
                <td className="max-w-[180px] truncate px-4 py-2.5 text-muted-foreground">{preview(a.inputText ?? a.instruction, 60)}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">{preview(a.outputText ?? a.error, 70)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
