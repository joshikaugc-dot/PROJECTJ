import { truncate } from "@contextos/shared";
import { BaseAdapter } from "./base-adapter";
import { isVisible, readableText } from "./dom";
import type { SelectionSnapshot } from "./types";

/** Selectors for Gmail's DOM. Centralized so a Gmail UI change is a one-line fix. */
export const GMAIL_SELECTORS = {
  body: 'div[aria-label="Message Body"][contenteditable="true"], div[g_editable="true"][contenteditable="true"], div[role="textbox"][contenteditable="true"]',
  subjectInput: 'input[name="subjectbox"]',
  recipientChip: "[data-hovercard-id][email], span[email]",
  threadSubject: "h2.hP",
  messageBody: "div.a3s",
};

function composeContainer(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 25; depth++) {
    if (node.querySelector?.(GMAIL_SELECTORS.subjectInput)) return node;
    node = node.parentElement;
  }
  return null;
}

export class GmailAdapter extends BaseAdapter {
  readonly id = "gmail";
  readonly name = "Gmail";

  detect(url: URL): boolean {
    return url.hostname === "mail.google.com";
  }

  protected override getSurface(snapshot: SelectionSnapshot): string | undefined {
    if (snapshot.kind !== "contenteditable") return snapshot.kind === "none" ? "page" : super.getSurface(snapshot);
    const container = composeContainer(snapshot.element);
    const subject = container?.querySelector<HTMLInputElement>(GMAIL_SELECTORS.subjectInput);
    if (subject && isVisible(subject)) return "email-compose";
    return "email-reply";
  }

  protected override getMetadata(snapshot: SelectionSnapshot): Record<string, string | number | boolean> {
    const meta: Record<string, string | number | boolean> = {};
    const container = composeContainer(snapshot.element);
    const subject = container?.querySelector<HTMLInputElement>(GMAIL_SELECTORS.subjectInput)?.value?.trim();
    const threadSubject = snapshot.pageDoc.querySelector(GMAIL_SELECTORS.threadSubject)?.textContent?.trim();
    if (subject) meta.emailSubject = truncate(subject, 200);
    else if (threadSubject) meta.emailSubject = truncate(threadSubject, 200);

    // Recipient display names only — never email addresses.
    if (container) {
      const names = [...container.querySelectorAll(GMAIL_SELECTORS.recipientChip)]
        .map((chip) => chip.getAttribute("name") || chip.textContent?.trim() || "")
        .filter((name) => name && !name.includes("@"));
      if (names.length) meta.recipients = truncate([...new Set(names)].slice(0, 5).join(", "), 200);
    }
    return meta;
  }

  /** The last messages of the open thread (used by follow-ups when permitted). */
  protected override getNearbyText(snapshot: SelectionSnapshot): string | undefined {
    const bodies = [...snapshot.pageDoc.querySelectorAll(GMAIL_SELECTORS.messageBody)]
      .filter((el) => !snapshot.element || !el.contains(snapshot.element))
      .map((el) => readableText(el))
      .filter(Boolean);
    if (bodies.length === 0) return undefined;
    return bodies.slice(-2).join("\n\n---\n\n");
  }
}
