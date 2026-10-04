"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Chrome, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Kbd, Label, Switch, Textarea } from "@contextos/ui";
import { api } from "@/lib/client";

export interface ProfileValues {
  name: string;
  jobTitle: string;
  department: string;
  seniority: string;
  responsibilities: string;
  writingPreferences: string;
}

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const set = (key: keyof ProfileValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setState("idle");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>ContextOS behaves differently for a Head of Marketing than for a Finance Analyst.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("saving");
            await api("/api/settings", "PATCH", { profile: values });
            setState("saved");
          }}
        >
          <div className="flex flex-col gap-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={values.name} onChange={set("name")} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="jobTitle">Role</Label><Input id="jobTitle" value={values.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Head of Marketing" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="department">Department</Label><Input id="department" value={values.department} onChange={set("department")} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="seniority">Seniority</Label><Input id="seniority" value={values.seniority} onChange={set("seniority")} /></div>
          <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor="resp">Responsibilities</Label><Textarea id="resp" rows={2} value={values.responsibilities} onChange={set("responsibilities")} /></div>
          <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor="prefs">Writing preferences</Label><Textarea id="prefs" rows={2} value={values.writingPreferences} onChange={set("writingPreferences")} placeholder="e.g. Short paragraphs. Sign emails with first name only." /></div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" size="sm" disabled={state === "saving"}>{state === "saving" && <Loader2 className="animate-spin" />} Save profile</Button>
            {state === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="size-3.5" /> Saved</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PrivacyForm({ historyEnabled, includePageContext }: { historyEnabled: boolean; includePageContext: boolean }) {
  const [history, setHistory] = useState(historyEnabled);
  const [pageContext, setPageContext] = useState(includePageContext);

  async function save(prefs: Record<string, boolean>) {
    await api("/api/settings", "PATCH", { preferences: prefs });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
        <CardDescription>
          ContextOS only reads the text you select or the field you are typing in, plus basic page info (app, title, URL without query string). It never uploads whole pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-medium">Save history</div>
            <p className="text-muted-foreground">Store your AI actions (input, output, context labels) so you can reopen them. When off, nothing is stored.</p>
          </div>
          <Switch checked={history} onCheckedChange={(v) => { setHistory(v); void save({ historyEnabled: v }); }} aria-label="Save history" />
        </div>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-medium">Always allow surrounding page context</div>
            <p className="text-muted-foreground">
              Lets actions use nearby text such as the email thread you are replying to. When off, nearby text is only used by actions that need it (e.g. Create Follow-Up) — and you can see it in the context inspector.
            </p>
          </div>
          <Switch checked={pageContext} onCheckedChange={(v) => { setPageContext(v); void save({ includePageContext: v }); }} aria-label="Allow page context" />
        </div>
      </CardContent>
    </Card>
  );
}

export interface TokenRow {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ExtensionCard({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  return (
    <Card id="extension">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Chrome className="size-4" /> Chrome extension</CardTitle>
        <CardDescription>
          Default shortcut: <Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>K</Kbd> on macOS, <Kbd>Ctrl</Kbd> <Kbd>⇧</Kbd> <Kbd>K</Kbd> on Windows. Change it at <span className="font-mono">chrome://extensions/shortcuts</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground">
          To connect: install the extension (see the README), click its toolbar icon and choose <b>Connect</b>. It will open this app and link automatically.
          You can also <Link href="/extension/connect" className="text-primary hover:underline">generate a token manually</Link>.
        </p>
        {tokens.length > 0 && (
          <div className="rounded-lg border border-border">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0">
                <div>
                  <div className="font-mono text-xs">{t.prefix}…</div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(t.createdAt).toLocaleDateString()} · {t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleString()}` : "never used"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api(`/api/extension/token/${t.id}`, "DELETE");
                    router.refresh();
                  }}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
