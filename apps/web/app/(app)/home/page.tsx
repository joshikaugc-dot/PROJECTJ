import Link from "next/link";
import { ArrowRight, Brain, Chrome, Sparkles } from "lucide-react";
import { getBrain, prisma } from "@contextos/database";
import { preview } from "@contextos/shared";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Kbd } from "@contextos/ui";
import { PageHeader } from "@/components/page-header";
import { Playground } from "@/components/playground";
import { requirePageAuth } from "@/lib/server/auth";
import { platform } from "@/lib/server/platform";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Home" };

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const { user, organization } = await requirePageAuth();
  const orgId = organization!.id;
  const [brain, recent, tokens, userContext] = await Promise.all([
    getBrain(prisma, orgId),
    prisma.aIAction.findMany({
      where: { userId: user.id, organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.apiToken.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: "desc" } }),
    platform().store.getUserContext(user.id, orgId),
  ]);
  const verticals = (userContext?.enabledVerticals ?? []).map((id) => platform().registry.get(id)).filter(Boolean);

  const sections = [
    { label: "Company", done: Boolean(brain.company.description) },
    { label: "Products", done: brain.products.length > 0 },
    { label: "Customers", done: brain.customers.length > 0 },
    { label: "Brand", done: brain.brand.voiceAttributes.length > 0 },
    { label: "Competitors", done: brain.competitors.length > 0 },
    { label: "Goals", done: brain.goals.length > 0 },
    { label: "Documents", done: brain.documents.length > 0 },
  ];
  const complete = sections.filter((s) => s.done).length;
  const extensionConnected = tokens.some((t) => t.lastUsedAt);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description={
          <>
            ContextOS knows <span className="font-medium text-foreground">{organization!.name}</span>
            {user.profile?.jobTitle ? <> and that you are <span className="font-medium text-foreground">{user.profile.jobTitle}</span></> : null}.
            {" "}Press <Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>K</Kbd> in any app to use it.
          </>
        }
        actions={verticals.map((v) => (
          <Badge key={v!.id} variant="default">{v!.name} active</Badge>
        ))}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Chrome className="size-4" /> Chrome extension</CardTitle>
            <CardDescription>
              {extensionConnected ? "Connected and in use." : tokens.length ? "Connected — try it in Gmail." : "Not connected yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant={extensionConnected ? "outline" : "default"}>
              <Link href="/settings#extension">{tokens.length ? "Manage" : "Connect extension"} <ArrowRight /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="size-4" /> Company Brain</CardTitle>
            <CardDescription>{complete} of {sections.length} sections complete.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-1">
              {sections.map((s) => (
                <div key={s.label} title={s.label} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <Button asChild size="sm" variant="outline"><Link href="/brain">Edit <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> AI model</CardTitle>
            <CardDescription>
              {platform().router.hasLiveProvider()
                ? "Live provider configured."
                : "Offline demo model — add ANTHROPIC_API_KEY for real AI."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline"><Link href="/models">AI Models <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Playground />
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recent.length === 0 && <p className="text-muted-foreground">No AI actions yet.</p>}
            {recent.map((a) => (
              <Link key={a.id} href={`/history/${a.id}`} className="group rounded-md -mx-2 px-2 py-1.5 hover:bg-muted">
                <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
                  <span className="truncate">{a.label}</span>
                  <span className="shrink-0 text-xs font-normal text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{a.appName} · {preview(a.outputText, 60) || a.error}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
