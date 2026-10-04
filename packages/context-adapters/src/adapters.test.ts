// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { detectAdapter } from "./registry";
import { GmailAdapter } from "./gmail-adapter";
import { LinkedInAdapter } from "./linkedin-adapter";
import { GenericWebAdapter } from "./generic-web-adapter";

function selectContents(el: Element, start?: number, end?: number) {
  const range = document.createRange();
  if (start === undefined) range.selectNodeContents(el);
  else {
    range.setStart(el.firstChild!, start);
    range.setEnd(el.firstChild!, end!);
  }
  const sel = document.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.title = "";
});

describe("detectAdapter", () => {
  it("picks the app adapter by URL and falls back to generic", () => {
    expect(detectAdapter(new URL("https://mail.google.com/mail/u/0/"), document).id).toBe("gmail");
    expect(detectAdapter(new URL("https://www.linkedin.com/feed/"), document).id).toBe("linkedin");
    expect(detectAdapter(new URL("https://docs.google.com/document/d/1/edit"), document).id).toBe("google-docs");
    expect(detectAdapter(new URL("https://www.notion.so/page"), document).id).toBe("notion");
    expect(detectAdapter(new URL("https://app.hubspot.com/contacts"), document).id).toBe("hubspot");
    expect(detectAdapter(new URL("https://example.com/"), document).id).toBe("generic");
  });
});

describe("GmailAdapter", () => {
  function compose(subjectVisible = true) {
    document.title = "Inbox (3) - alex@northstar.test - Gmail";
    document.body.innerHTML = `
      <h2 class="hP">Northstar pricing</h2>
      <div class="a3s">John: could you send pricing?</div>
      <div role="dialog">
        <span email="john@acme.com" name="John Smith">John Smith</span>
        <input name="subjectbox" value="Introducing the Northstar Band" ${subjectVisible ? "" : 'type="hidden"'} />
        <div id="body" aria-label="Message Body" role="textbox" contenteditable="true">Hi John, just wanted to follow up.</div>
      </div>`;
    const body = document.getElementById("body")!;
    body.focus();
    return body;
  }

  it("captures compose context without leaking email addresses", () => {
    const body = compose();
    selectContents(body);
    const adapter = new GmailAdapter();
    const snapshot = adapter.captureSnapshot(document);
    const ctx = adapter.getContext(snapshot);
    expect(snapshot.kind).toBe("contenteditable");
    expect(ctx.selectedText).toBe("Hi John, just wanted to follow up.");
    expect(ctx.surface).toBe("email-compose");
    expect(ctx.metadata).toMatchObject({ emailSubject: "Introducing the Northstar Band", recipients: "John Smith" });
    expect(JSON.stringify(ctx)).not.toContain("john@acme.com");
    expect(ctx.pageTitle).toBe("Inbox (3) - [email] - Gmail");
  });

  it("detects replies and reads the thread as nearby text", () => {
    compose(false);
    const adapter = new GmailAdapter();
    const ctx = adapter.getContext(adapter.captureSnapshot(document));
    expect(ctx.surface).toBe("email-reply");
    expect(ctx.metadata.emailSubject).toBe("Northstar pricing");
    expect(ctx.nearbyText).toContain("could you send pricing");
  });

  it("replaces the selected text in the compose body", async () => {
    const body = compose();
    selectContents(body, 9, 34);
    const adapter = new GmailAdapter();
    const snapshot = adapter.captureSnapshot(document);
    expect(snapshot.selectedText).toBe("just wanted to follow up.");
    const result = await adapter.replaceSelection(snapshot, "following up on our launch.");
    expect(result.ok).toBe(true);
    expect(body.textContent).toBe("Hi John, following up on our launch.");
  });
});

describe("GenericWebAdapter", () => {
  it("replaces a textarea selection and notifies frameworks", async () => {
    document.body.innerHTML = `<label for="bio">Company bio</label><textarea id="bio">We sell a really great band</textarea>`;
    const area = document.getElementById("bio") as HTMLTextAreaElement;
    let inputEvents = 0;
    area.addEventListener("input", () => inputEvents++);
    area.focus();
    area.setSelectionRange(8, 27);
    const adapter = new GenericWebAdapter();
    const snapshot = adapter.captureSnapshot(document);
    const ctx = adapter.getContext(snapshot);
    expect(ctx.activeElementType).toBe("textarea");
    expect(ctx.metadata.fieldLabel).toBe("Company bio");
    await adapter.replaceSelection(snapshot, "a band for better sleep");
    expect(area.value).toBe("We sell a band for better sleep");
    expect(inputEvents).toBeGreaterThan(0);
  });

  it("inserts after the selection and replaces the whole field when nothing is selected", async () => {
    document.body.innerHTML = `<textarea id="t">First line</textarea>`;
    const area = document.getElementById("t") as HTMLTextAreaElement;
    area.focus();
    area.setSelectionRange(0, 5);
    const adapter = new GenericWebAdapter();
    await adapter.insertText(adapter.captureSnapshot(document), "Added");
    expect(area.value).toBe("First\n\nAdded line");

    area.setSelectionRange(3, 3);
    await adapter.replaceSelection(adapter.captureSnapshot(document), "Fresh");
    expect(area.value).toBe("Fresh");
  });

  it("strips query strings and fragments from the page URL", () => {
    document.body.innerHTML = `<textarea id="t">x</textarea>`;
    (document.getElementById("t") as HTMLTextAreaElement).focus();
    const adapter = new GenericWebAdapter();
    const ctx = adapter.getContext(adapter.captureSnapshot(document));
    expect(ctx.pageUrl).not.toContain("?");
    expect(ctx.pageUrl).not.toContain("#");
  });

  it("reports page selections as read-only", () => {
    document.body.innerHTML = `<p id="p">Some article text</p>`;
    selectContents(document.getElementById("p")!);
    (document.activeElement as HTMLElement | null)?.blur?.();
    const adapter = new GenericWebAdapter();
    const snapshot = adapter.captureSnapshot(document);
    expect(snapshot.kind).toBe("document");
    expect(snapshot.selectedText).toBe("Some article text");
    expect(adapter.canWrite(snapshot)).toBe(false);
  });
});

describe("LinkedInAdapter", () => {
  it("recognizes the comment box and reads the post being discussed", () => {
    document.body.innerHTML = `
      <div class="feed-shared-update-v2">
        <div class="feed-shared-update-v2__description">Recovery is underrated.</div>
        <div class="comments-comment-box"><div id="c" class="ql-editor" contenteditable="true"></div></div>
      </div>`;
    (document.getElementById("c") as HTMLElement).focus();
    const adapter = new LinkedInAdapter();
    const ctx = adapter.getContext(adapter.captureSnapshot(document));
    expect(ctx.surface).toBe("comment");
    expect(ctx.nearbyText).toBe("Recovery is underrated.");
  });

  it("recognizes the post composer", () => {
    document.body.innerHTML = `<div class="share-creation-state"><div id="c" class="ql-editor" contenteditable="true"></div></div>`;
    (document.getElementById("c") as HTMLElement).focus();
    const adapter = new LinkedInAdapter();
    expect(adapter.getContext(adapter.captureSnapshot(document)).surface).toBe("post-composer");
  });
});
