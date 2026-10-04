import { GenericWebAdapter } from "./generic-web-adapter";
import { GmailAdapter } from "./gmail-adapter";
import { GoogleDocsAdapter } from "./google-docs-adapter";
import { HubSpotAdapter } from "./hubspot-adapter";
import { LinkedInAdapter } from "./linkedin-adapter";
import { NotionAdapter } from "./notion-adapter";
import type { AppAdapter } from "./types";

/**
 * Ordered list of app adapters; the generic adapter is always last. Adding
 * support for an app = writing an adapter and adding it here.
 */
export function createAdapters(): AppAdapter[] {
  return [
    new GmailAdapter(),
    new LinkedInAdapter(),
    new GoogleDocsAdapter(),
    new NotionAdapter(),
    new HubSpotAdapter(),
    new GenericWebAdapter(),
  ];
}

export function detectAdapter(url: URL, doc: Document, adapters: AppAdapter[] = createAdapters()): AppAdapter {
  return adapters.find((adapter) => adapter.detect(url, doc)) ?? new GenericWebAdapter();
}
