import { BaseAdapter } from "./base-adapter";
import { readableText } from "./dom";
import type { InsertResult, SelectionSnapshot } from "./types";

const EVENT_TARGET_IFRAME = "iframe.docs-texteventtarget-iframe";

/**
 * Google Docs (beta). Docs renders text on a canvas, so the DOM does not
 * expose the document text. We read the selection when Docs exposes it
 * (accessibility/DOM rendering modes) and write by typing into Docs' hidden
 * input target, which Docs treats as keyboard input. When neither is
 * available the overlay falls back to copy/paste.
 */
export class GoogleDocsAdapter extends BaseAdapter {
  readonly id = "google-docs";
  readonly name = "Google Docs";

  detect(url: URL): boolean {
    return url.hostname === "docs.google.com" && url.pathname.startsWith("/document/");
  }

  private eventTarget(doc: Document): { body: HTMLElement; doc: Document } | null {
    const iframe = doc.querySelector<HTMLIFrameElement>(EVENT_TARGET_IFRAME);
    try {
      const inner = iframe?.contentDocument;
      const body = inner?.querySelector<HTMLElement>("[contenteditable='true']") ?? inner?.body;
      return body && inner ? { body, doc: inner } : null;
    } catch {
      return null;
    }
  }

  override captureSnapshot(pageDoc: Document): SelectionSnapshot {
    const snapshot = super.captureSnapshot(pageDoc);
    const target = this.eventTarget(pageDoc);
    // Docs mirrors the selection into the top document in some rendering modes.
    const selectedText = snapshot.selectedText || pageDoc.getSelection()?.toString() || "";
    if (!target) return { ...snapshot, selectedText };
    return {
      ...snapshot,
      element: target.body,
      doc: target.doc,
      kind: "contenteditable",
      selectedText,
      range: null,
      source: selectedText.trim() ? "selection" : "none",
      anchor: snapshot.anchor ?? { top: 120, left: pageDoc.defaultView ? pageDoc.defaultView.innerWidth / 2 - 210 : 200, bottom: 120, right: 0 },
    };
  }

  override getEditableContent(snapshot: SelectionSnapshot): string {
    // Only available when Docs uses DOM rendering.
    const lines = [...snapshot.pageDoc.querySelectorAll(".kix-lineview-text-block")].map((l) => readableText(l));
    return lines.join("\n");
  }

  protected override getSurface(): string {
    return "document";
  }

  protected override getMetadata(snapshot: SelectionSnapshot): Record<string, string | number | boolean> {
    const title = snapshot.pageDoc.querySelector<HTMLInputElement>(".docs-title-input")?.value?.trim();
    return title ? { documentTitle: title.slice(0, 200) } : {};
  }

  private async typeIntoDocs(snapshot: SelectionSnapshot, text: string): Promise<InsertResult> {
    const target = this.eventTarget(snapshot.pageDoc);
    if (!target) return { ok: false, method: "none", message: "Couldn't reach the Google Docs editor. Use Copy and paste instead." };
    target.body.focus();
    let ok = false;
    try {
      ok = target.doc.execCommand("insertText", false, text);
    } catch {
      ok = false;
    }
    return ok
      ? { ok: true, method: "execCommand", message: "Typed into Google Docs" }
      : { ok: false, method: "none", message: "Google Docs blocked the insert. Use Copy and paste instead." };
  }

  // Typing in Docs replaces the active selection, so both operations type.
  override replaceSelection(snapshot: SelectionSnapshot, text: string): Promise<InsertResult> {
    return this.typeIntoDocs(snapshot, text);
  }

  override insertText(snapshot: SelectionSnapshot, text: string): Promise<InsertResult> {
    return this.typeIntoDocs(snapshot, text);
  }
}
