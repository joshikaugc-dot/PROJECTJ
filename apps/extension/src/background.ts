/**
 * Service worker. Responsibilities:
 *  1. Keyboard shortcut → inject the content script into the active tab
 *     (activeTab grants access only at that moment; nothing runs on pages before).
 *  2. Receive the API token from the ContextOS web app (externally_connectable).
 *  3. Open the connect page on install / on request.
 */
import { API_ORIGIN, API_URL } from "./lib/config";
import { setToken } from "./lib/storage";

const RESTRICTED = /^(chrome|edge|about|chrome-extension|devtools|view-source):|^https:\/\/chromewebstore\.google\.com|^https:\/\/chrome\.google\.com\/webstore/;

async function toggleOverlay(tabId: number | undefined, url?: string): Promise<{ ok: boolean; error?: string }> {
  if (tabId === undefined) return { ok: false, error: "No active tab" };
  if (url && RESTRICTED.test(url)) return { ok: false, error: "ContextOS can't run on browser pages." };
  try {
    // Re-injecting is cheap; the content script toggles itself if already present.
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

function openConnectPage() {
  void chrome.tabs.create({ url: `${API_URL}/extension/connect?ext=${chrome.runtime.id}` });
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-overlay") void toggleOverlay(tab?.id, tab?.url);
});

chrome.runtime.onMessage.addListener((message: { type?: string; tabId?: number; url?: string }, _sender, sendResponse) => {
  if (message?.type === "contextos:open-connect") {
    openConnectPage();
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "contextos:toggle") {
    void toggleOverlay(message.tabId, message.url).then(sendResponse);
    return true;
  }
  return false;
});

// The web app hands us a token after the user clicks "Connect" there.
chrome.runtime.onMessageExternal.addListener((message: { type?: string; token?: unknown }, sender, sendResponse) => {
  if (sender.origin !== API_ORIGIN) {
    sendResponse({ ok: false, error: "Untrusted origin" });
    return false;
  }
  if (message?.type === "contextos:connect" && typeof message.token === "string" && message.token.startsWith("ctx_")) {
    void setToken(message.token).then(() => sendResponse({ ok: true }));
    return true;
  }
  sendResponse({ ok: false, error: "Unknown message" });
  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") openConnectPage();
});
