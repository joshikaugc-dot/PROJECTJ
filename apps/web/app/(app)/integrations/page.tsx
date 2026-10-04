import { Badge, Card, CardContent } from "@contextos/ui";
import { PageHeader } from "@/components/page-header";
import { requirePageAuth } from "@/lib/server/auth";

export const metadata = { title: "Integrations" };

const APPS = [
  { name: "Gmail", how: "Read selection & compose context, replace/insert text", status: "extension", next: "Native drafts via Gmail API" },
  { name: "LinkedIn", how: "Post composer, comments and messages", status: "extension", next: "Scheduled publishing" },
  { name: "Any website", how: "Textareas, inputs and rich-text editors", status: "extension", next: "—" },
  { name: "Google Docs", how: "Typing into documents; selection where Docs exposes it", status: "beta", next: "Docs API: create briefs as documents" },
  { name: "Notion", how: "Blocks and pages", status: "extension", next: "Notion API: create pages" },
  { name: "HubSpot", how: "Notes and emails", status: "extension", next: "Log activities, update CRM records" },
];

export default async function IntegrationsPage() {
  await requirePageAuth();
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Today ContextOS works inside these apps through the Chrome extension — no account connections needed. Native API integrations (drafts, CRM updates, publishing) plug into the execution layer later."
      />
      <Card className="overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">App</th>
              <th className="px-4 py-2 font-medium">What works today</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {APPS.map((app) => (
              <tr key={app.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{app.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{app.how}</td>
                <td className="px-4 py-3">
                  {app.status === "beta" ? <Badge variant="warning">Beta</Badge> : <Badge variant="success">Via extension</Badge>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{app.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-4">
        <CardContent className="p-5 text-muted-foreground">
          Planned: macOS and Windows desktop apps with a system-wide shortcut, using the same API and adapters model as the extension.
        </CardContent>
      </Card>
    </>
  );
}
