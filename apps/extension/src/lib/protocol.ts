import type { AppContext, ExecutionActionType } from "@contextos/shared/client";

/**
 * Messages between the content script (in the page) and the overlay iframe
 * (an extension page). They travel over a private MessageChannel set up with
 * a per-open nonce, so the host page cannot inject or read them.
 */

export interface OverlayCapabilities {
  canReplace: boolean;
  canInsert: boolean;
  /** "selection" | "field" | "none" — what Replace will overwrite. */
  source: "selection" | "field" | "none";
}

export type ContentToOverlay =
  | { type: "context"; appContext: AppContext; capabilities: OverlayCapabilities; placement: "below" | "above" | "center" }
  | { type: "executed"; requestId: string; ok: boolean; message?: string };

export type OverlayToContent =
  | { type: "ready" }
  | { type: "resize"; height: number }
  | { type: "execute"; requestId: string; action: Exclude<ExecutionActionType, "copy">; text: string }
  | { type: "dirty"; dirty: boolean }
  | { type: "close"; reason: "escape" | "button" | "done"; toast?: string };

export const INIT_MESSAGE = "contextos:init";
