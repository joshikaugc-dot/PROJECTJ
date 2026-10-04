import { BaseAdapter } from "./base-adapter";
import type { SelectionSnapshot } from "./types";

export class HubSpotAdapter extends BaseAdapter {
  readonly id = "hubspot";
  readonly name = "HubSpot";

  detect(url: URL): boolean {
    return url.hostname === "app.hubspot.com" || url.hostname.endsWith(".hubspot.com");
  }

  protected override getSurface(snapshot: SelectionSnapshot): string | undefined {
    if (!snapshot.element) return "page";
    return snapshot.element.closest("[data-test-id*='email'], [data-selenium-test*='email']") ? "email-compose" : "crm-note";
  }
}
