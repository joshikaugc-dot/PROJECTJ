import type { ActionExecutor, ExecutionRequest, ExecutionResult, ExecutionType } from "./base-executor";

/** Copies text with the async Clipboard API, falling back to execCommand("copy"). */
export class ClipboardExecutor implements ActionExecutor {
  readonly id = "clipboard";
  readonly handles: readonly ExecutionType[] = ["copy"];

  constructor(private readonly doc: Document = document) {}

  canExecute(): boolean {
    return true;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const nav = this.doc.defaultView?.navigator;
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(request.text);
        return { ok: true, type: "copy", executor: this.id, method: "clipboard-api" };
      }
    } catch {
      // fall through to legacy copy
    }
    const area = this.doc.createElement("textarea");
    area.value = request.text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    this.doc.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = this.doc.execCommand("copy");
    } finally {
      area.remove();
    }
    return { ok, type: "copy", executor: this.id, method: "execCommand" };
  }
}
