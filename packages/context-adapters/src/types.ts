import type { ActiveElementType, AppContext } from "@contextos/shared";

/**
 * Everything captured at the moment the user invoked ContextOS. The overlay
 * steals focus, so we snapshot the selection first and restore it later to
 * replace/insert text exactly where the user was.
 */
export interface SelectionSnapshot {
  /** The editable element (textarea/input/contenteditable root), if any. */
  element: HTMLElement | null;
  kind: ActiveElementType;
  /** Selected text ("" when the selection is collapsed). */
  selectedText: string;
  /** Live range for contenteditable / page selections. */
  range: Range | null;
  /** Offsets for textarea/input selections. */
  start: number | null;
  end: number | null;
  /** Where the overlay should anchor, in viewport coordinates. */
  anchor: { top: number; left: number; bottom: number; right: number } | null;
  /** The document the selection lives in (may be a same-origin iframe). */
  doc: Document;
  /** The top-level page document (title/url come from here). */
  pageDoc: Document;
  /** Whether the text came from a selection or the whole field. */
  source: "selection" | "field" | "none";
}

export type InsertMethod = "execCommand" | "setRangeText" | "dom" | "clipboard" | "none";

export interface InsertResult {
  ok: boolean;
  method: InsertMethod;
  message?: string;
}

export interface ContextOptions {
  /** Max characters of field content to capture. */
  maxFieldChars?: number;
  /** Max characters of surrounding page text to capture. */
  maxNearbyChars?: number;
}

/**
 * An adapter knows how to read context from — and write text back to — one
 * application. All product logic lives elsewhere; adapters only translate
 * between an app's DOM and the generic AppContext.
 */
export interface AppAdapter {
  readonly id: string;
  readonly name: string;
  /** Whether this adapter handles the current page. */
  detect(url: URL, doc: Document): boolean;
  /** Snapshot the focused field and selection. Call before showing any UI. */
  captureSnapshot(doc: Document): SelectionSnapshot;
  getContext(snapshot: SelectionSnapshot, options?: ContextOptions): AppContext;
  getSelectedText(snapshot: SelectionSnapshot): string;
  getEditableContent(snapshot: SelectionSnapshot): string;
  /** Insert at the cursor (or right after the selection). */
  insertText(snapshot: SelectionSnapshot, text: string): Promise<InsertResult>;
  /** Replace the selection; with no selection, replace the field's content. */
  replaceSelection(snapshot: SelectionSnapshot, text: string): Promise<InsertResult>;
  /** Whether text can be written back into the page. */
  canWrite(snapshot: SelectionSnapshot): boolean;
}
