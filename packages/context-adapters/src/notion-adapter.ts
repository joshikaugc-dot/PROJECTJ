import { BaseAdapter } from "./base-adapter";
import type { SelectionSnapshot } from "./types";

export class NotionAdapter extends BaseAdapter {
  readonly id = "notion";
  readonly name = "Notion";

  detect(url: URL): boolean {
    return /(^|\.)notion\.(so|site)$/.test(url.hostname);
  }

  protected override getSurface(snapshot: SelectionSnapshot): string | undefined {
    return snapshot.element ? "document" : "page";
  }

  protected override getMetadata(snapshot: SelectionSnapshot): Record<string, string | number | boolean> {
    const title = snapshot.pageDoc.querySelector(".notion-page-block h1, [placeholder='Untitled']")?.textContent?.trim();
    return title ? { documentTitle: title.slice(0, 200) } : {};
  }
}
