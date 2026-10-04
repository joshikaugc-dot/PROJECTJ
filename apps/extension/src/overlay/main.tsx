import { createRoot } from "react-dom/client";
import { INIT_MESSAGE } from "../lib/protocol";
import { App } from "./App";

/**
 * The overlay only accepts a MessagePort from the content script that created
 * it: the init message must carry the nonce placed in this frame's URL hash.
 * The frame lives in a closed shadow root, so the page cannot read the nonce.
 */
const nonce = location.hash.slice(1);

function onInit(event: MessageEvent) {
  const data = event.data as { type?: string; nonce?: string } | undefined;
  if (data?.type !== INIT_MESSAGE || !nonce || data.nonce !== nonce || !event.ports[0]) return;
  window.removeEventListener("message", onInit);
  createRoot(document.getElementById("root")!).render(<App port={event.ports[0]} />);
}

window.addEventListener("message", onInit);
