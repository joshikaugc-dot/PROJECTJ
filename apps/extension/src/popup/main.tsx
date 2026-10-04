import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PRODUCT, type BootstrapResponse } from "@contextos/shared/client";
import { api, ApiClientError } from "../lib/api";
import { API_URL } from "../lib/config";
import { clearToken, setToken } from "../lib/storage";

const isMac = navigator.platform.toLowerCase().includes("mac");

function Popup() {
  const [state, setState] = useState<"loading" | "signed-out" | "ready" | "error">("loading");
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [shortcut, setShortcut] = useState<string>(isMac ? "⌘⇧K" : "Ctrl+Shift+K");

  async function load() {
    setState("loading");
    try {
      setBoot(await api.bootstrap());
      setState("ready");
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 401 || e.code === "signed_out")) setState("signed-out");
      else {
        setError((e as Error).message);
        setState("error");
      }
    }
  }

  useEffect(() => {
    void load();
    chrome.commands.getAll((commands) => {
      const command = commands.find((c) => c.name === "toggle-overlay");
      if (command?.shortcut) setShortcut(command.shortcut);
      else setShortcut("Not set");
    });
  }, []);

  async function openOnPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = (await chrome.runtime.sendMessage({ type: "contextos:toggle", tabId: tab?.id, url: tab?.url })) as { ok: boolean; error?: string };
    if (response?.ok) window.close();
    else setError(response?.error ?? "Can't open ContextOS on this page.");
  }

  const connect = () => void chrome.runtime.sendMessage({ type: "contextos:open-connect" });

  return (
    <div className="popup-panel">
      <div className="popup-row">
        <div className="brand">
          <img src="icons/icon-32.png" width={18} height={18} alt="" /> {PRODUCT.name}
        </div>
        <span className="muted">{shortcut}</span>
      </div>

      {state === "loading" && <div className="muted">Loading…</div>}

      {state === "ready" && boot && (
        <>
          <div className="popup-card">
            <div className="k">Signed in</div>
            <div className="v">{boot.user.name}{boot.user.role ? ` · ${boot.user.role}` : ""}</div>
            <div className="muted">{boot.organization?.name ?? "No organization"} · {boot.activeVertical?.name ?? "No vertical"}</div>
          </div>
          <button className="btn primary" onClick={() => void openOnPage()}>Open on this page</button>
          <p className="muted" style={{ margin: 0 }}>
            Select text in Gmail, LinkedIn or any text field and press <b>{shortcut}</b>.
          </p>
          <div className="popup-row">
            <button className="link" onClick={() => void chrome.tabs.create({ url: `${API_URL}/home` })}>Open dashboard</button>
            <button className="link" onClick={() => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}>Change shortcut</button>
            <button className="link" onClick={() => void clearToken().then(load)}>Disconnect</button>
          </div>
        </>
      )}

      {state === "signed-out" && (
        <>
          <p className="muted" style={{ margin: 0 }}>Connect {PRODUCT.name} to your account so it can use your Company Brain.</p>
          <button className="btn primary" onClick={connect}>Connect</button>
          {!manual ? (
            <button className="link" onClick={() => setManual(true)}>Paste a token instead</button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const token = tokenInput.trim();
                if (token.startsWith("ctx_")) void setToken(token).then(load);
                else setError("Tokens start with ctx_");
              }}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <textarea rows={3} value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="ctx_…" aria-label="Token" />
              <button className="btn" type="submit">Save token</button>
            </form>
          )}
        </>
      )}

      {error && <div className="banner error">{error}</div>}
      {state === "error" && <button className="btn" onClick={() => void load()}>Retry</button>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
