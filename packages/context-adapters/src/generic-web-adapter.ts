import { BaseAdapter } from "./base-adapter";

/**
 * Works on any site: textareas, text inputs and contenteditable editors.
 * Used whenever no app-specific adapter matches.
 */
export class GenericWebAdapter extends BaseAdapter {
  readonly id = "generic";
  readonly name: string = "Web";

  detect(): boolean {
    return true;
  }

  override getContext(...args: Parameters<BaseAdapter["getContext"]>) {
    const ctx = super.getContext(...args);
    // Name the app after the site so the indicator reads e.g. "acme.com Context".
    const host = ctx.domain.replace(/^www\./, "");
    return { ...ctx, appName: host || "Web" };
  }
}
