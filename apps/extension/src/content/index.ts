/**
 * Content script — injected on demand when the user presses the shortcut.
 *
 * It is intentionally thin: it asks the matching app adapter for a snapshot
 * of the selection/field, opens the overlay (an isolated extension iframe in a
 * closed shadow root), and executes insert/replace through the execution layer.
 * It never talks to the API and never sees the user's token.
 */
import { detectAdapter, isTextInput, isTextarea, type AppAdapter, type SelectionSnapshot } from "@contextos/context-adapters";
import { ExecutorRegistry, WebTextExecutor } from "@contextos/execution";
import { PRODUCT } from "@contextos/shared/client";
import { INIT_MESSAGE, type ContentToOverlay, type OverlayCapabilities, type OverlayToContent } from "../lib/protocol";

interface Controller {
  toggle(): void;
}

declare global {
  interface Window {
    __contextosController?: Controller;
  }
}

const WIDTH = 440;
const MARGIN = 12;
const Z = "2147483647";

const FRAME_CSS = `
  .frame {
    position: fixed; width: ${WIDTH}px; height: 380px; border: 0; margin: 0; padding: 0;
    border-radius: 14px; background: transparent; color-scheme: normal;
    box-shadow: 0 0 0 1px rgba(15,15,30,.08), 0 18px 50px -12px rgba(15,15,40,.35), 0 6px 16px -6px rgba(15,15,40,.18);
    opacity: 0; transform: translateY(4px) scale(.985); transition: opacity .12s ease, transform .12s ease;
  }
  .frame.visible { opacity: 1; transform: none; }
  @media (prefers-color-scheme: dark) { .frame { box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 18px 50px -12px rgba(0,0,0,.6); } }
  .toast {
    position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
    font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    background: #18181b; color: #fafafa; padding: 9px 14px; border-radius: 999px;
    box-shadow: 0 10px 30px -8px rgba(0,0,0,.4); opacity: 0; transition: opacity .15s ease;
  }
  .toast.visible { opacity: 1; }
`;

interface Session {
  close(reason: "escape" | "button" | "done" | "toggle" | "outside", toast?: string): void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function maxHeight() {
  return Math.min(580, window.innerHeight - MARGIN * 2);
}

function computePlacement(anchor: SelectionSnapshot["anchor"], height: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = Math.min(height, maxHeight());
  if (!anchor || anchor.bottom - anchor.top > vh * 0.5) {
    return { top: Math.max(MARGIN, Math.round(vh * 0.14)), left: Math.round((vw - WIDTH) / 2), placement: "center" as const };
  }
  const left = clamp(anchor.left, MARGIN, vw - WIDTH - MARGIN);
  const spaceBelow = vh - anchor.bottom - MARGIN;
  const spaceAbove = anchor.top - MARGIN;
  if (spaceBelow >= Math.min(h, 360) || spaceBelow >= spaceAbove) {
    return { top: clamp(anchor.bottom + 8, MARGIN, vh - h - MARGIN), left, placement: "below" as const };
  }
  return { top: Math.max(MARGIN, anchor.top - 8 - h), left, placement: "above" as const };
}

function restoreFocus(snapshot: SelectionSnapshot) {
  const el = snapshot.element;
  if (!el || !el.isConnected) return;
  try {
    el.focus({ preventScroll: true });
    if ((isTextarea(el) || isTextInput(el)) && snapshot.start !== null && snapshot.end !== null) {
      el.setSelectionRange(snapshot.start, snapshot.end);
    } else if (snapshot.range && snapshot.range.startContainer.isConnected) {
      const selection = snapshot.doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(snapshot.range);
    }
  } catch {
    // best effort
  }
}

function showToast(message: string) {
  const host = document.createElement("contextos-toast");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = Z;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>${FRAME_CSS}</style><div class="toast" role="status">${PRODUCT.name} · </div>`;
  const toast = shadow.querySelector(".toast") as HTMLDivElement;
  toast.append(document.createTextNode(message));
  document.documentElement.appendChild(host);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => toast.classList.remove("visible"), 1600);
  setTimeout(() => host.remove(), 1900);
}

function openOverlay(adapter: AppAdapter, snapshot: SelectionSnapshot, onClosed: () => void): Session {
  const appContext = adapter.getContext(snapshot);
  const writable = adapter.canWrite(snapshot);
  const capabilities: OverlayCapabilities = { canReplace: writable, canInsert: writable, source: snapshot.source };
  const executors = new ExecutorRegistry().register(new WebTextExecutor());

  const host = document.createElement("contextos-overlay");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = Z;
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = FRAME_CSS;
  const iframe = document.createElement("iframe");
  const nonce = crypto.randomUUID();
  iframe.className = "frame";
  iframe.src = `${chrome.runtime.getURL("overlay.html")}#${nonce}`;
  iframe.allow = "clipboard-write";
  iframe.title = PRODUCT.name;
  shadow.append(style, iframe);
  document.documentElement.appendChild(host);

  let height = 380;
  let dirty = false;
  let closed = false;
  let port: MessagePort | null = null;
  let placement = computePlacement(snapshot.anchor, height);

  const applyPosition = () => {
    iframe.style.top = `${placement.top}px`;
    iframe.style.left = `${placement.left}px`;
    iframe.style.height = `${Math.min(height, maxHeight())}px`;
  };
  applyPosition();

  const send = (message: ContentToOverlay) => port?.postMessage(message);

  const onPointerDown = (event: Event) => {
    if (!dirty && event.target !== host) session.close("outside");
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !dirty) session.close("escape");
  };
  const onResize = () => {
    placement = computePlacement(snapshot.anchor, height);
    applyPosition();
  };

  const session: Session = {
    close(reason, toast) {
      if (closed) return;
      closed = true;
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      port?.close();
      iframe.classList.remove("visible");
      setTimeout(() => host.remove(), 120);
      if (reason !== "done" && reason !== "outside") restoreFocus(snapshot);
      if (toast) showToast(toast);
      onClosed();
    },
  };

  const handle = async (event: MessageEvent<OverlayToContent>) => {
    const message = event.data;
    switch (message.type) {
      case "ready":
        send({ type: "context", appContext, capabilities, placement: placement.placement });
        break;
      case "resize":
        height = Math.max(120, Math.ceil(message.height));
        if (placement.placement === "above") placement = computePlacement(snapshot.anchor, height);
        else placement = { ...placement, top: clamp(placement.top, MARGIN, window.innerHeight - Math.min(height, maxHeight()) - MARGIN) };
        applyPosition();
        break;
      case "dirty":
        dirty = message.dirty;
        break;
      case "execute": {
        const result = await executors.execute({
          type: message.action,
          text: message.text,
          target: { adapter, snapshot },
        });
        send({ type: "executed", requestId: message.requestId, ok: result.ok, message: result.message });
        break;
      }
      case "close":
        session.close(message.reason, message.toast);
        break;
    }
  };

  iframe.addEventListener("load", () => {
    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = (e) => void handle(e as MessageEvent<OverlayToContent>);
    const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
    iframe.contentWindow?.postMessage({ type: INIT_MESSAGE, nonce }, extensionOrigin, [channel.port2]);
    iframe.classList.add("visible");
    iframe.focus();
  });

  document.addEventListener("mousedown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", onResize);
  return session;
}

function createController(): Controller {
  let session: Session | null = null;
  return {
    toggle() {
      if (session) {
        session.close("toggle");
        return;
      }
      const adapter = detectAdapter(new URL(location.href), document);
      const snapshot = adapter.captureSnapshot(document);
      session = openOverlay(adapter, snapshot, () => {
        session = null;
      });
    },
  };
}

if (!window.__contextosController) window.__contextosController = createController();
window.__contextosController.toggle();
