import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { PRODUCT, preview, type AppContext, type BootstrapResponse, type ExecutionActionType, type RecommendResponse, type RecommendedAction, type RunRequest, type RunResponse } from "@contextos/shared/client";
import { api, ApiClientError } from "../lib/api";
import type { ContentToOverlay, OverlayCapabilities, OverlayToContent } from "../lib/protocol";
import { getIncludePageContext, setIncludePageContext } from "../lib/storage";
import { copyText } from "./clipboard";
import { ActionIcon } from "./icons";

type Phase = "connecting" | "signed-out" | "loading" | "actions" | "running" | "result" | "error";

interface HostContext {
  appContext: AppContext;
  capabilities: OverlayCapabilities;
}

interface RunParams {
  actionId?: string;
  instruction?: string;
  previousOutput?: string;
  label: string;
  usesPageContext?: boolean;
}

const isMac = navigator.platform.toLowerCase().includes("mac");
const MOD = isMac ? "⌘" : "Ctrl";

/** Keep what we send to the recommendation endpoint small: it only needs to know what's there. */
function forRecommendation(ctx: AppContext): AppContext {
  return {
    ...ctx,
    nearbyText: undefined,
    selectedText: ctx.selectedText?.slice(0, 1000),
    fieldValue: ctx.fieldValue?.slice(0, 1000),
  };
}

export function App({ port }: { port: MessagePort }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(new Map<string, (r: { ok: boolean; message?: string }) => void>());
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<Phase>("connecting");
  const [host, setHost] = useState<HostContext | null>(null);
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [recs, setRecs] = useState<RecommendResponse | null>(null);
  const [verticalId, setVerticalId] = useState<string | undefined>();
  const [highlight, setHighlight] = useState(0);
  const [ask, setAsk] = useState("");
  const [refine, setRefine] = useState("");
  const [running, setRunning] = useState<RunParams | null>(null);
  const [lastRun, setLastRun] = useState<RunParams | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inspect, setInspect] = useState(false);
  const [pageContext, setPageContext] = useState(false);
  const [busy, setBusy] = useState<ExecutionActionType | null>(null);

  const post = useCallback((message: OverlayToContent) => port.postMessage(message), [port]);
  const close = useCallback(
    (reason: "escape" | "button" | "done", toast?: string) => post({ type: "close", reason, toast }),
    [post],
  );

  /* ---------------- Wiring to the content script ---------------- */

  useEffect(() => {
    port.onmessage = (event: MessageEvent<ContentToOverlay>) => {
      const message = event.data;
      if (message.type === "context") {
        setHost({ appContext: message.appContext, capabilities: message.capabilities });
      } else if (message.type === "executed") {
        pending.current.get(message.requestId)?.({ ok: message.ok, message: message.message });
        pending.current.delete(message.requestId);
      }
    };
    post({ type: "ready" });
  }, [port, post]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => post({ type: "resize", height: el.getBoundingClientRect().height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [post]);

  useEffect(() => {
    post({ type: "dirty", dirty: phase === "result" || phase === "running" });
  }, [phase, post]);

  /* ---------------- Loading ---------------- */

  const loadRecommendations = useCallback(async (ctx: HostContext, vertical?: string) => {
    const recommendations = await api.recommend(forRecommendation(ctx.appContext), vertical);
    setRecs(recommendations);
    setHighlight(0);
  }, []);

  useEffect(() => {
    if (!host) return;
    setPhase("loading");
    (async () => {
      try {
        const [bootstrap, override] = await Promise.all([api.bootstrap(), getIncludePageContext()]);
        setBoot(bootstrap);
        setPageContext(override ?? bootstrap.preferences.includePageContext);
        await loadRecommendations(host, verticalId);
        setPhase("actions");
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 401 || e.code === "signed_out")) setPhase("signed-out");
        else {
          setError((e as Error).message);
          setPhase("error");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => {
    if (phase === "actions") askRef.current?.focus();
    if (phase === "result") editorRef.current?.focus();
  }, [phase]);

  /* ---------------- Running ---------------- */

  const run = useCallback(
    async (params: RunParams) => {
      if (!host) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(params);
      setError(null);
      setNotice(null);
      setInspect(false);
      setPhase("running");
      const sendNearby = pageContext || params.usesPageContext;
      const body: RunRequest = {
        appContext: { ...host.appContext, nearbyText: sendNearby ? host.appContext.nearbyText : undefined },
        verticalId: recs?.vertical.id,
        actionId: params.actionId,
        instruction: params.instruction,
        previousOutput: params.previousOutput,
        includePageContext: pageContext,
        conversationId: params.previousOutput ? (result?.conversationId ?? undefined) : undefined,
      };
      try {
        const response = await api.run(body, controller.signal);
        setResult(response);
        setDraft(response.output);
        setLastRun(params.previousOutput ? lastRun : params);
        setRefine("");
        setPhase("result");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof ApiClientError && e.status === 401) {
          setPhase("signed-out");
          return;
        }
        setError((e as Error).message);
        setPhase(result ? "result" : "error");
      } finally {
        setRunning(null);
      }
    },
    [host, pageContext, recs, result, lastRun],
  );

  const runAction = (action: RecommendedAction) =>
    run({ actionId: action.id, label: action.label, usesPageContext: action.usesPageContext });

  const runAsk = () => {
    const instruction = ask.trim();
    if (instruction) void run({ instruction, label: instruction });
  };

  /* ---------------- Execution ---------------- */

  const execute = useCallback(
    async (type: ExecutionActionType) => {
      if (!result || !host) return;
      const text = draft;
      setBusy(type);
      setError(null);
      try {
        if (type === "copy") {
          const ok = await copyText(text);
          if (!ok) throw new Error("Your browser blocked clipboard access.");
          if (result.actionRecordId) void api.markExecuted(result.actionRecordId, "copy").catch(() => undefined);
          setNotice("Copied to clipboard");
          setTimeout(() => close("done", "Copied to clipboard"), 450);
          return;
        }
        const requestId = crypto.randomUUID();
        const outcome = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
          pending.current.set(requestId, resolve);
          post({ type: "execute", requestId, action: type, text });
        });
        if (!outcome.ok) {
          const copied = await copyText(text);
          setError(`${outcome.message ?? `Couldn't ${type} the text here.`}${copied ? " The result was copied — paste it with " + MOD + "+V." : ""}`);
          return;
        }
        if (result.actionRecordId) void api.markExecuted(result.actionRecordId, type).catch(() => undefined);
        close("done", type === "replace" ? `Replaced in ${host.appContext.appName}` : `Inserted into ${host.appContext.appName}`);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [result, host, draft, post, close],
  );

  const canReplace = Boolean(result?.allowedActions.includes("replace") && host?.capabilities.canReplace);
  const canInsert = Boolean(result?.allowedActions.includes("insert") && host?.capabilities.canInsert);
  const primary: ExecutionActionType = canReplace && host?.capabilities.source !== "none" ? "replace" : canInsert ? "insert" : "copy";

  /* ---------------- Keyboard ---------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (phase === "running") {
          abortRef.current?.abort();
          setPhase(result ? "result" : "actions");
          return;
        }
        close("escape");
        return;
      }
      if (phase === "actions" && recs && !ask) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setHighlight((h) => Math.min(h + 1, recs.actions.length - 1));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
        } else if (event.key === "Enter" && recs.actions[highlight]) {
          event.preventDefault();
          void runAction(recs.actions[highlight]!);
        }
      }
      if (phase === "result" && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void execute(primary);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recs, ask, highlight, result, primary, execute, close]);

  /* ---------------- Rendering ---------------- */

  const app = host?.appContext;
  const selectionText = app?.selectedText || app?.fieldValue || "";
  const contextLabels = result?.context.labels ?? recs?.contextPreview ?? [];
  const pageContextLabel = app?.appId === "gmail" ? "Include email thread" : "Include page context";
  const verticals = boot?.enabledVerticals ?? [];

  const header = (
    <div className="header">
      <div className="brand">
        <span className="mark" aria-hidden>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /></svg>
        </span>
        {PRODUCT.name}
      </div>
      <div className="chips">
        {recs && verticals.length > 1 ? (
          <select
            className="chip accent"
            value={recs.vertical.id}
            onChange={(e) => {
              setVerticalId(e.target.value);
              if (host) void loadRecommendations(host, e.target.value);
            }}
            aria-label="Vertical"
          >
            {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        ) : recs ? (
          <span className="chip accent">{recs.vertical.name}</span>
        ) : null}
        {app && <span className="chip">{app.appName}</span>}
      </div>
      <button className="icon-btn" onClick={() => close("button")} aria-label="Close" title="Close (Esc)">
        <X size={15} />
      </button>
    </div>
  );

  const footer = contextLabels.length > 0 && (
    <>
      {inspect && result && (
        <div className="inspector">
          {result.context.blocks.map((b) => (
            <div className="block" key={`${b.key}-${b.label}`}>
              <span className="title">{b.label}</span> <span className="reason">— {b.reason}</span>
              <pre>{b.content}</pre>
            </div>
          ))}
        </div>
      )}
      <div className="footer">
        <span className="using"><ShieldCheck size={12} /> Using</span>
        {contextLabels.slice(0, 4).map((label) => <span className="ctx" key={label}>{label}</span>)}
        {contextLabels.length > 4 && (
          <span className="ctx" title={contextLabels.slice(4).join(", ")}>+{contextLabels.length - 4}</span>
        )}
        <span className="spacer" />
        {result && (
          <button className="link" onClick={() => setInspect((v) => !v)}>
            {inspect ? "Hide context" : "Inspect"} <ChevronDown size={10} style={{ transform: inspect ? "rotate(180deg)" : undefined }} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="panel" ref={rootRef}>
      {header}

      {(phase === "connecting" || phase === "loading") && (
        <div className="running">
          <div className="skeleton" style={{ width: "70%" }} />
          <div className="skeleton" style={{ width: "55%" }} />
          <div className="skeleton" style={{ width: "62%" }} />
        </div>
      )}

      {phase === "signed-out" && (
        <div className="signed-out">
          <h2>Connect {PRODUCT.name}</h2>
          <p>Sign in once and {PRODUCT.name} will know your company, role and brand everywhere you work.</p>
          <button className="btn primary" onClick={() => void chrome.runtime.sendMessage({ type: "contextos:open-connect" })}>
            Connect account
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="body">
          <div className="banner error">{error}</div>
          <div><button className="btn" onClick={() => host && setHost({ ...host })}>Try again</button></div>
        </div>
      )}

      {phase === "actions" && recs && (
        <>
          <div className="body">
            {selectionText ? (
              <div className="selection">
                <span className="quote">“{preview(selectionText, 90)}”</span>
                <span className="meta">{app?.selectedText ? `${app.selectedText.length} chars selected` : "field text"}</span>
              </div>
            ) : (
              <div className="selection"><span className="quote">No text selected</span><span className="meta">select text for more actions</span></div>
            )}
            <div className="section-label">Recommended</div>
            <div className="actions" role="listbox" aria-label="Recommended actions">
              {recs.actions.length === 0 && <div className="empty">Select some text to see actions, or ask below.</div>}
              {recs.actions.map((action, index) => (
                <button
                  key={action.id}
                  role="option"
                  aria-selected={index === highlight}
                  className={`action ${index === highlight ? "active" : ""}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => void runAction(action)}
                  title={action.reason}
                >
                  <span className="icon"><ActionIcon name={action.icon} /></span>
                  <span className="text">
                    <div className="label">{action.label}</div>
                    {action.description && <div className="desc">{action.description}</div>}
                  </span>
                  <span className="hint"><CornerDownLeft size={12} /></span>
                </button>
              ))}
            </div>
          </div>
          <div className="ask">
            <form
              className="ask-box"
              onSubmit={(e) => {
                e.preventDefault();
                runAsk();
              }}
            >
              <input
                ref={askRef}
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder={recs.askPlaceholder}
                aria-label={recs.askPlaceholder}
              />
              {ask ? <kbd>↵</kbd> : <kbd>↑↓</kbd>}
            </form>
          </div>
          {app?.nearbyText && (
            <div className="footer" style={{ borderTop: "1px solid var(--border)" }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={pageContext}
                  onChange={(e) => {
                    setPageContext(e.target.checked);
                    void setIncludePageContext(e.target.checked);
                  }}
                />
                {pageContextLabel}
              </label>
              <span className="spacer" />
              <span>Only sent when enabled or needed</span>
            </div>
          )}
          {footer}
        </>
      )}

      {phase === "running" && running && (
        <>
          <div className="running">
            <div className="title"><Loader2 size={14} className="spin" /> {running.previousOutput ? "Refining" : running.label}…</div>
            <div className="skeleton" style={{ width: "92%" }} />
            <div className="skeleton" style={{ width: "84%" }} />
            <div className="skeleton" style={{ width: "66%" }} />
            <div className="muted" style={{ fontSize: 11.5 }}>Esc to cancel</div>
          </div>
          {footer}
        </>
      )}

      {phase === "result" && result && (
        <>
          <div className="body">
            <div className="result-head">
              <button className="icon-btn" onClick={() => setPhase("actions")} aria-label="Back to actions" title="Back">
                <ArrowLeft size={14} />
              </button>
              <span className="name">{lastRun?.label ?? result.skill.name}</span>
              <span className="meta">{result.model} · {(result.latencyMs / 1000).toFixed(1)}s</span>
            </div>
            {result.demoMode && (
              <div className="banner warn">Offline demo model — add an AI provider key to the ContextOS server for real results.</div>
            )}
            {result.extras && result.extras.length > 0 && (
              <div className="extras">
                {result.extras.map((extra) => (
                  <div className="extra" key={extra.label}>
                    <span className="k">{extra.label}</span>
                    <span className="v">{extra.value}</span>
                    <button className="icon-btn" title={`Copy ${extra.label.toLowerCase()}`} onClick={() => void copyText(extra.value).then(() => setNotice(`${extra.label} copied`))}>
                      <Copy size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={editorRef}
              className="editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Result (editable)"
              rows={Math.min(12, Math.max(5, draft.split("\n").length + 1))}
            />
            {error && <div className="banner error">{error}</div>}
            {notice && <div className="muted"><Check size={11} /> {notice}</div>}
            <form
              className="ask-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (refine.trim()) void run({ instruction: refine.trim(), previousOutput: draft, label: lastRun?.label ?? "Refine" });
              }}
            >
              <input value={refine} onChange={(e) => setRefine(e.target.value)} placeholder="Refine: shorter, warmer, add a P.S.…" aria-label="Refine result" />
              {refine && <kbd>↵</kbd>}
            </form>
          </div>
          {footer}
          <div className="buttons">
            {canReplace && (
              <button className={`btn ${primary === "replace" ? "primary" : ""}`} disabled={Boolean(busy)} onClick={() => void execute("replace")}>
                {busy === "replace" ? <Loader2 size={13} className="spin" /> : null}
                {host?.capabilities.source === "selection" ? "Replace" : "Replace field"}
                {primary === "replace" && <kbd>{MOD}↵</kbd>}
              </button>
            )}
            {canInsert && (
              <button className={`btn ${primary === "insert" ? "primary" : ""}`} disabled={Boolean(busy)} onClick={() => void execute("insert")}>
                Insert {primary === "insert" && <kbd>{MOD}↵</kbd>}
              </button>
            )}
            <button className={`btn ${primary === "copy" ? "primary" : ""}`} disabled={Boolean(busy)} onClick={() => void execute("copy")}>
              <Copy size={13} /> Copy {primary === "copy" && <kbd>{MOD}↵</kbd>}
            </button>
            <button className="btn ghost" disabled={Boolean(busy) || !lastRun} onClick={() => lastRun && void run(lastRun)} title="Regenerate">
              <RefreshCw size={13} />
            </button>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => close("button")}>Discard</button>
          </div>
        </>
      )}
    </div>
  );
}
