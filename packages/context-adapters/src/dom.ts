/** Low-level DOM helpers shared by adapters. Kept framework-free. */

export function isTextInput(el: Element | null): el is HTMLInputElement {
  if (!el || el.tagName !== "INPUT") return false;
  const type = ((el as HTMLInputElement).type || "text").toLowerCase();
  return ["text", "search", "email", "url", "tel", ""].includes(type);
}

export function isTextarea(el: Element | null): el is HTMLTextAreaElement {
  return Boolean(el && el.tagName === "TEXTAREA");
}

export function isContentEditable(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const html = el as HTMLElement;
  if (html.isContentEditable) return true;
  // jsdom does not implement isContentEditable; fall back to the attribute.
  const attr = el.getAttribute?.("contenteditable");
  if (attr === "" || attr === "true" || attr === "plaintext-only") return true;
  return Boolean(el.closest?.('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'));
}

/** Walk into shadow roots and same-origin iframes to find the real focused element. */
export function deepActiveElement(doc: Document): { element: Element | null; doc: Document } {
  let active: Element | null = doc.activeElement;
  let currentDoc = doc;
  for (let depth = 0; depth < 10 && active; depth++) {
    if (active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
      continue;
    }
    if (active.tagName === "IFRAME") {
      try {
        const inner = (active as HTMLIFrameElement).contentDocument;
        if (inner?.activeElement && inner.activeElement !== inner.body) {
          currentDoc = inner;
          active = inner.activeElement;
          continue;
        }
        if (inner?.body && isContentEditable(inner.body)) {
          currentDoc = inner;
          active = inner.body;
        }
      } catch {
        // cross-origin iframe — not accessible
      }
    }
    break;
  }
  return { element: active, doc: currentDoc };
}

/** The outermost element of a contenteditable region. */
export function editableRoot(el: Element): HTMLElement {
  let node = el as HTMLElement;
  while (node.parentElement && isContentEditable(node.parentElement)) {
    node = node.parentElement;
  }
  return node;
}

/** innerText where available (respects layout/line breaks), textContent otherwise. */
export function readableText(el: Element | null | undefined): string {
  if (!el) return "";
  const html = el as HTMLElement;
  const text = typeof html.innerText === "string" ? html.innerText : (el.textContent ?? "");
  return text.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function rectOf(target: Element | Range | null): { top: number; left: number; bottom: number; right: number } | null {
  if (!target) return null;
  try {
    const r = target.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0)) return null;
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
  } catch {
    return null;
  }
}

/** Accessible label for a field: aria-label, <label for>, placeholder or name. */
export function fieldLabel(el: HTMLElement | null): string | undefined {
  if (!el) return undefined;
  const aria = el.getAttribute("aria-label") ?? el.getAttribute("aria-placeholder");
  if (aria) return aria;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  if (el.id) {
    const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }
  return el.getAttribute("placeholder") ?? el.getAttribute("name") ?? undefined;
}

/** Collapse whitespace for robust "did the insert land?" comparisons. */
export function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function dispatchInput(el: HTMLElement, data: string, inputType = "insertText") {
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: false, inputType, data }));
  } catch {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Set a value through the native setter so React-controlled inputs notice. */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = isTextarea(el) ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

export function isVisible(el: Element | null): boolean {
  if (!el) return false;
  const html = el as HTMLElement;
  if (html.hidden || (el as HTMLInputElement).type === "hidden") return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(html);
  return !(style && (style.display === "none" || style.visibility === "hidden"));
}
