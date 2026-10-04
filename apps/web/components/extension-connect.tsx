"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, Card, CardContent } from "@contextos/ui";
import { api } from "@/lib/client";
import { CopyButton } from "./copy-button";

interface ChromeRuntime {
  sendMessage(extensionId: string, message: unknown, callback: (response: unknown) => void): void;
  lastError?: { message?: string };
}

function chromeRuntime(): ChromeRuntime | undefined {
  return (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

/**
 * Links the Chrome extension: mints a token from this signed-in session and
 * hands it to the extension via `externally_connectable` messaging. Falls back
 * to a copyable token.
 */
export function ExtensionConnect({ extensionId }: { extensionId: string | null }) {
  const [state, setState] = useState<"idle" | "working" | "connected" | "manual" | "error">("idle");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function connect() {
    setState("working");
    setError(null);
    try {
      const { token: newToken, apiUrl } = await api<{ token: string; apiUrl: string }>("/api/extension/token", "POST");
      setToken(newToken);
      const runtime = chromeRuntime();
      if (!extensionId || !runtime?.sendMessage) {
        setState("manual");
        return;
      }
      runtime.sendMessage(extensionId, { type: "contextos:connect", token: newToken, apiUrl }, (response) => {
        const ok = (response as { ok?: boolean } | undefined)?.ok;
        if (runtime.lastError || !ok) setState("manual");
        else setState("connected");
      });
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  useEffect(() => {
    // Opened from the extension popup: connect right away.
    if (extensionId && !started.current) {
      started.current = true;
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensionId]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        {state === "connected" ? (
          <>
            <CheckCircle2 className="size-10 text-emerald-500" />
            <div>
              <div className="text-base font-semibold">Extension connected</div>
              <p className="mt-1 text-muted-foreground">Open Gmail, select some text and press ⌘⇧K (Ctrl+Shift+K on Windows). You can close this tab.</p>
            </div>
          </>
        ) : state === "manual" && token ? (
          <>
            <div>
              <div className="text-base font-semibold">Paste this token into the extension</div>
              <p className="mt-1 text-muted-foreground">Click the ContextOS icon in Chrome&apos;s toolbar → “Paste token”. Treat it like a password.</p>
            </div>
            <code className="w-full break-all rounded-md border border-border bg-muted px-3 py-2 text-left font-mono text-xs">{token}</code>
            <CopyButton text={token} label="Copy token" />
          </>
        ) : (
          <>
            <div>
              <div className="text-base font-semibold">Connect the ContextOS extension</div>
              <p className="mt-1 text-muted-foreground">This links the extension to your account so it can use your Company Brain.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={connect} disabled={state === "working"}>
              {state === "working" && <Loader2 className="animate-spin" />} {extensionId ? "Connect extension" : "Generate token"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
