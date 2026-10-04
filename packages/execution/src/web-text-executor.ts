import type { AppAdapter, SelectionSnapshot } from "@contextos/context-adapters";
import type { ActionExecutor, ExecutionRequest, ExecutionResult, ExecutionType } from "./base-executor";

export interface WebTextTarget {
  adapter: AppAdapter;
  snapshot: SelectionSnapshot;
}

/** Writes text back into the page through the app adapter that captured it. */
export class WebTextExecutor implements ActionExecutor<WebTextTarget> {
  readonly id = "web-text";
  readonly handles: readonly ExecutionType[] = ["replace", "insert"];

  canExecute(request: ExecutionRequest<WebTextTarget>): boolean {
    const target = request.target;
    return Boolean(target && target.adapter.canWrite(target.snapshot));
  }

  async execute(request: ExecutionRequest<WebTextTarget>): Promise<ExecutionResult> {
    const { adapter, snapshot } = request.target!;
    const result =
      request.type === "replace"
        ? await adapter.replaceSelection(snapshot, request.text)
        : await adapter.insertText(snapshot, request.text);
    return {
      ok: result.ok,
      type: request.type,
      executor: this.id,
      method: result.method,
      message: result.message,
    };
  }
}
