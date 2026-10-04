"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { AppContext, RecommendResponse, RunResponse } from "@contextos/shared/client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea, cn } from "@contextos/ui";
import { api } from "@/lib/client";
import { ContextChips } from "./context-chips";

const APPS = [
  { id: "gmail", name: "Gmail", domain: "mail.google.com", surface: "email-compose" },
  { id: "linkedin", name: "LinkedIn", domain: "www.linkedin.com", surface: "post-composer" },
  { id: "google-docs", name: "Google Docs", domain: "docs.google.com", surface: "document" },
  { id: "generic", name: "Web", domain: "example.com", surface: "form-field" },
] as const;

const SAMPLE =
  "Hi John, just wanted to follow up regarding our new platform. We really think you will love it, it has lots of great features for sleep and stress. Let me know if you want to chat!";

/**
 * Simulates the extension overlay inside the dashboard: the same API calls
 * with a synthetic AppContext. Handy for demos and for testing verticals.
 */
export function Playground() {
  const [appId, setAppId] = useState<(typeof APPS)[number]["id"]>("gmail");
  const [text, setText] = useState(SAMPLE);
  const [recs, setRecs] = useState<RecommendResponse | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastRun, setLastRun] = useState<{ actionId?: string; instruction?: string } | null>(null);

  const appContext: AppContext = useMemo(() => {
    const app = APPS.find((a) => a.id === appId)!;
    return {
      appId: app.id,
      appName: app.name,
      domain: app.domain,
      pageTitle: `${app.name} — playground`,
      pageUrl: `https://${app.domain}/`,
      selectedText: text || undefined,
      activeElementType: "contenteditable",
      fieldValue: text || undefined,
      surface: app.surface,
      metadata: {},
    };
  }, [appId, text]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api<RecommendResponse>("/api/v1/recommendations", "POST", { appContext })
        .then(setRecs)
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [appContext]);

  async function run(params: { actionId?: string; instruction?: string }) {
    setRunning(params.actionId ?? "ask");
    setError(null);
    setLastRun(params);
    try {
      setResult(await api<RunResponse>("/api/v1/run", "POST", { appContext, ...params }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Try ContextOS</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Same engine as the Chrome extension — pick an app, select an action.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {APPS.map((app) => (
            <button
              key={app.id}
              onClick={() => setAppId(app.id)}
              className={cn("rounded-md px-2.5 py-1 text-xs", appId === app.id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {app.name}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Selected text" />
        <div className="flex flex-wrap gap-2">
          {recs?.actions.map((action) => (
            <Button key={action.id} variant="outline" size="sm" disabled={Boolean(running)} onClick={() => run({ actionId: action.id })} title={action.reason}>
              {running === action.id ? <Loader2 className="animate-spin" /> : <Sparkles className="text-primary" />}
              {action.label}
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) run({ instruction: ask.trim() });
          }}
        >
          <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={recs?.askPlaceholder ?? "Ask…"} />
          <Button type="submit" variant="secondary" disabled={!ask.trim() || Boolean(running)}>
            {running === "ask" ? <Loader2 className="animate-spin" /> : "Ask"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{result.skill.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{result.provider} · {result.model}</span>
                  <span>{(result.latencyMs / 1000).toFixed(1)}s</span>
                  {result.workflowTrace.length > 1 && <span>{result.workflowTrace.length}-step workflow</span>}
                  {result.demoMode && <Badge variant="warning">Demo model — add an API key for real AI</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {copied ? <Check /> : <Copy />} Copy
                </Button>
                <Button size="sm" variant="ghost" disabled={Boolean(running) || !lastRun} onClick={() => lastRun && run(lastRun)}>
                  <RefreshCw /> Regenerate
                </Button>
              </div>
            </div>
            {result.extras?.map((extra) => (
              <div key={extra.label} className="text-xs"><span className="text-muted-foreground">{extra.label}:</span> {extra.value}</div>
            ))}
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{result.output}</pre>
            <ContextChips labels={result.context.labels} blocks={result.context.blocks} />
          </div>
        )}
        {!result && recs && <ContextChips labels={recs.contextPreview} />}
      </CardContent>
    </Card>
  );
}
