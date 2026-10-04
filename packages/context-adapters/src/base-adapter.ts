import { sanitizeUrl, truncate, type AppContext } from "@contextos/shared";
import {
  deepActiveElement,
  dispatchInput,
  editableRoot,
  fieldLabel,
  isContentEditable,
  isTextInput,
  isTextarea,
  normalizeForCompare,
  readableText,
  rectOf,
  setNativeValue,
} from "./dom";
import type {
  AppAdapter,
  ContextOptions,
  InsertResult,
  SelectionSnapshot,
} from "./types";

const DEFAULT_OPTIONS: Required<ContextOptions> = { maxFieldChars: 12_000, maxNearbyChars: 4_000 };
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Let the page's editor react (frameworks may apply edits in a microtask/frame). */
function settle(win: Window | null): Promise<void> {
  return new Promise((resolve) => {
    if (win?.requestAnimationFrame) win.requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 16);
  });
}

function landed(container: HTMLElement, text: string, before: string): boolean {
  const after = normalizeForCompare(readableText(container) || container.textContent || "");
  if (after === normalizeForCompare(before)) return false;
  const probe = normalizeForCompare(text).slice(0, 40);
  return probe.length === 0 || after.includes(probe);
}

/**
 * Generic behaviour that works on plain textareas, inputs and contenteditable
 * editors. App adapters subclass this and override the protected hooks to add
 * app-specific context (surface, metadata, nearby text) — they rarely need to
 * touch reading/writing at all.
 */
export abstract class BaseAdapter implements AppAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract detect(url: URL, doc: Document): boolean;

  /* ---------------- Hooks for subclasses ---------------- */

  /** What kind of thing the user is writing. */
  protected getSurface(snapshot: SelectionSnapshot): string | undefined {
    if (snapshot.kind === "none" || snapshot.kind === "document") return "page";
    return "form-field";
  }

  /** Small, non-sensitive facts about the current screen. */
  protected getMetadata(snapshot: SelectionSnapshot): Record<string, string | number | boolean> {
    const label = fieldLabel(snapshot.element);
    return label ? { fieldLabel: truncate(label, 120) } : {};
  }

  /** Surrounding text (e.g. a thread). Only sent to the server when permitted. */
  protected getNearbyText(_snapshot: SelectionSnapshot): string | undefined {
    return undefined;
  }

  /** Find the editable element for the focused element. */
  protected resolveEditable(active: Element | null): HTMLElement | null {
    if (!active) return null;
    if (isTextarea(active) || isTextInput(active)) return active as HTMLElement;
    if (isContentEditable(active)) return editableRoot(active);
    return null;
  }

  /* ---------------- Reading ---------------- */

  captureSnapshot(pageDoc: Document): SelectionSnapshot {
    const { element: active, doc } = deepActiveElement(pageDoc);
    const editable = this.resolveEditable(active);
    const base = { doc, pageDoc, range: null, start: null, end: null } as const;

    if (editable && (isTextarea(editable) || isTextInput(editable))) {
      const start = editable.selectionStart ?? editable.value.length;
      const end = editable.selectionEnd ?? start;
      const selectedText = editable.value.slice(start, end);
      return {
        ...base,
        element: editable,
        kind: isTextarea(editable) ? "textarea" : "input",
        selectedText,
        start,
        end,
        anchor: rectOf(editable),
        source: selectedText.trim() ? "selection" : editable.value.trim() ? "field" : "none",
      };
    }

    const selection = doc.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (editable) {
      const inside = range && editable.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
      const selectedText = inside && !inside.collapsed ? (selection?.toString() ?? inside.toString()) : "";
      return {
        ...base,
        element: editable,
        kind: "contenteditable",
        selectedText,
        range: inside,
        anchor: (inside && !inside.collapsed ? rectOf(inside) : null) ?? rectOf(editable),
        source: selectedText.trim() ? "selection" : readableText(editable) ? "field" : "none",
      };
    }

    // No focused field: maybe a selection inside an editor that lost focus, or plain page text.
    if (range && !range.collapsed) {
      const container =
        range.commonAncestorContainer.nodeType === 1
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      const selectedText = selection?.toString() ?? range.toString();
      if (container && isContentEditable(container)) {
        return {
          ...base,
          element: editableRoot(container),
          kind: "contenteditable",
          selectedText,
          range: range.cloneRange(),
          anchor: rectOf(range),
          source: "selection",
        };
      }
      return {
        ...base,
        element: null,
        kind: "document",
        selectedText,
        range: range.cloneRange(),
        anchor: rectOf(range),
        source: "selection",
      };
    }

    return { ...base, element: null, kind: "none", selectedText: "", anchor: null, source: "none" };
  }

  getSelectedText(snapshot: SelectionSnapshot): string {
    return snapshot.selectedText;
  }

  getEditableContent(snapshot: SelectionSnapshot): string {
    const el = snapshot.element;
    if (!el) return "";
    if (isTextarea(el) || isTextInput(el)) return el.value;
    return readableText(el);
  }

  getContext(snapshot: SelectionSnapshot, options: ContextOptions = {}): AppContext {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const page = snapshot.pageDoc;
    const href = page.location?.href ?? "";
    let domain = "";
    try {
      domain = new URL(href).hostname;
    } catch {
      domain = "";
    }
    const fieldValue = this.getEditableContent(snapshot);
    const nearby = this.getNearbyText(snapshot);
    return {
      appId: this.id,
      appName: this.name,
      domain,
      // Page titles often contain the user's email address (e.g. Gmail) — redact it.
      pageTitle: truncate((page.title ?? "").replace(EMAIL_PATTERN, "[email]"), 300),
      pageUrl: sanitizeUrl(href),
      selectedText: snapshot.selectedText.trim() ? truncate(snapshot.selectedText, 20_000) : undefined,
      fieldValue: fieldValue.trim() ? truncate(fieldValue, opts.maxFieldChars) : undefined,
      nearbyText: nearby?.trim() ? truncate(nearby.trim(), opts.maxNearbyChars) : undefined,
      activeElementType: snapshot.kind,
      surface: this.getSurface(snapshot),
      metadata: this.getMetadata(snapshot),
    };
  }

  canWrite(snapshot: SelectionSnapshot): boolean {
    return Boolean(snapshot.element && snapshot.element.isConnected);
  }

  /* ---------------- Writing ---------------- */

  async replaceSelection(snapshot: SelectionSnapshot, text: string): Promise<InsertResult> {
    const el = snapshot.element;
    if (!el || !el.isConnected) return { ok: false, method: "none", message: "The original field is no longer on the page." };

    if (isTextarea(el) || isTextInput(el)) {
      const hasSelection = snapshot.start !== null && snapshot.end !== null && snapshot.end > snapshot.start;
      const from = hasSelection ? snapshot.start! : 0;
      const to = hasSelection ? snapshot.end! : el.value.length;
      return this.writeTextControl(el, from, to, text);
    }

    const range = this.restoreRange(snapshot, "replace");
    return this.writeContentEditable(el, snapshot.doc, range, text);
  }

  async insertText(snapshot: SelectionSnapshot, text: string): Promise<InsertResult> {
    const el = snapshot.element;
    if (!el || !el.isConnected) return { ok: false, method: "none", message: "The original field is no longer on the page." };
    const afterSelection = snapshot.selectedText.trim().length > 0;

    if (isTextarea(el) || isTextInput(el)) {
      const pos = snapshot.end ?? el.value.length;
      const separator = afterSelection ? (isTextarea(el) ? "\n\n" : " ") : "";
      return this.writeTextControl(el, pos, pos, `${separator}${text}`);
    }

    const range = this.restoreRange(snapshot, "insert");
    return this.writeContentEditable(el, snapshot.doc, range, afterSelection ? `\n\n${text}` : text);
  }

  /** Recreate the range to write into. */
  protected restoreRange(snapshot: SelectionSnapshot, mode: "replace" | "insert"): Range {
    const root = snapshot.element!;
    const doc = snapshot.doc;
    let range: Range | null = null;

    const saved = snapshot.range;
    if (saved && saved.startContainer.isConnected && root.contains(saved.commonAncestorContainer)) {
      range = saved.cloneRange();
    } else if (snapshot.selectedText.trim()) {
      range = findTextRange(root, snapshot.selectedText);
    }

    if (!range) {
      range = doc.createRange();
      range.selectNodeContents(root);
      // Replace with nothing selected = replace the field; insert = append at the end.
      if (mode === "insert") range.collapse(false);
    } else if (mode === "insert") {
      range.collapse(false);
    }
    return range;
  }

  protected async writeTextControl(
    el: HTMLInputElement | HTMLTextAreaElement,
    from: number,
    to: number,
    text: string,
  ): Promise<InsertResult> {
    const doc = el.ownerDocument;
    const before = el.value;
    el.focus({ preventScroll: true });
    try {
      el.setSelectionRange(from, to);
    } catch {
      // some input types do not support selection ranges
    }

    let ok = false;
    try {
      ok = typeof doc.execCommand === "function" && doc.execCommand("insertText", false, text);
    } catch {
      ok = false;
    }
    await settle(doc.defaultView);
    const expected = before.slice(0, from) + text + before.slice(to);
    if (ok && el.value === expected) return { ok: true, method: "execCommand" };
    if (ok && el.value !== before) return { ok: true, method: "execCommand" };

    // Fallback: set the value directly and notify frameworks.
    setNativeValue(el, expected);
    const caret = from + text.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // ignore
    }
    dispatchInput(el, text);
    return { ok: el.value === expected, method: "setRangeText" };
  }

  protected async writeContentEditable(
    root: HTMLElement,
    doc: Document,
    range: Range,
    text: string,
  ): Promise<InsertResult> {
    const before = readableText(root) || root.textContent || "";
    root.focus({ preventScroll: true });
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    let ok = false;
    try {
      ok = typeof doc.execCommand === "function" && doc.execCommand("insertText", false, text);
    } catch {
      ok = false;
    }
    await settle(doc.defaultView);
    if (ok && landed(root, text, before)) return { ok: true, method: "execCommand" };
    if (ok) {
      // The editor accepted the command but changed nothing visible; don't double-insert.
      const now = readableText(root) || root.textContent || "";
      if (now !== before) return { ok: true, method: "execCommand" };
    }

    // Fallback: direct DOM edit (works for simple contenteditable fields).
    const active = doc.getSelection()?.rangeCount ? doc.getSelection()!.getRangeAt(0) : range;
    active.deleteContents();
    const fragment = doc.createDocumentFragment();
    text.split("\n").forEach((line, index) => {
      if (index > 0) fragment.appendChild(doc.createElement("br"));
      if (line) fragment.appendChild(doc.createTextNode(line));
    });
    const last = fragment.lastChild;
    active.insertNode(fragment);
    if (last) {
      const caret = doc.createRange();
      caret.setStartAfter(last);
      caret.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(caret);
    }
    dispatchInput(root, text);
    return { ok: landed(root, text, before), method: "dom" };
  }
}

/** Locate `needle` inside a single text node of `root` (fallback when a saved range was invalidated). */
export function findTextRange(root: HTMLElement, needle: string): Range | null {
  const target = needle.trim();
  if (!target) return null;
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const index = (node.textContent ?? "").indexOf(target);
    if (index >= 0) {
      const range = doc.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + target.length);
      return range;
    }
  }
  return null;
}
