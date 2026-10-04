import { BaseAdapter } from "./base-adapter";
import { readableText } from "./dom";
import type { SelectionSnapshot } from "./types";

export const LINKEDIN_SELECTORS = {
  postComposer: ".share-creation-state, .share-box, .share-box-v2__modal, [data-test-modal-id='sharebox']",
  comment: ".comments-comment-box, .comments-comment-texteditor, .comments-comment-box-comment__text-editor",
  message: ".msg-form, .msg-form__contenteditable",
  post: ".feed-shared-update-v2, [data-urn^='urn:li:activity'], article",
  postText: ".feed-shared-update-v2__description, .update-components-text, .feed-shared-text",
  messageItem: ".msg-s-event-listitem__body",
};

export class LinkedInAdapter extends BaseAdapter {
  readonly id = "linkedin";
  readonly name = "LinkedIn";

  detect(url: URL): boolean {
    return url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
  }

  protected override getSurface(snapshot: SelectionSnapshot): string | undefined {
    const el = snapshot.element;
    if (!el) return snapshot.kind === "document" ? "page" : "page";
    if (el.closest(LINKEDIN_SELECTORS.comment)) return "comment";
    if (el.closest(LINKEDIN_SELECTORS.message)) return "message";
    if (el.closest(LINKEDIN_SELECTORS.postComposer)) return "post-composer";
    return super.getSurface(snapshot);
  }

  /** The post being commented on, or the recent messages in a conversation. */
  protected override getNearbyText(snapshot: SelectionSnapshot): string | undefined {
    const el = snapshot.element;
    if (!el) return undefined;
    if (el.closest(LINKEDIN_SELECTORS.comment)) {
      const post = el.closest(LINKEDIN_SELECTORS.post);
      return readableText(post?.querySelector(LINKEDIN_SELECTORS.postText)) || undefined;
    }
    if (el.closest(LINKEDIN_SELECTORS.message)) {
      const items = [...snapshot.pageDoc.querySelectorAll(LINKEDIN_SELECTORS.messageItem)]
        .map((m) => readableText(m))
        .filter(Boolean);
      return items.slice(-4).join("\n") || undefined;
    }
    return undefined;
  }
}
