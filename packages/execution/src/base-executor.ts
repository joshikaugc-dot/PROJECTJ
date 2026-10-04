import type { ExecutionActionType } from "@contextos/shared/client";

/**
 * Execution layer: turns an AI result into an effect in the user's world.
 * MVP effects are text effects (insert / replace / copy). Future executors
 * (Gmail drafts, HubSpot activities, Google Docs, CRM updates) implement the
 * same interface with their own action types — no changes to callers.
 */
export type ExecutionType = ExecutionActionType | `${string}.${string}`;

export interface ExecutionRequest<TTarget = unknown> {
  type: ExecutionType;
  text: string;
  /** Executor-specific target (e.g. a selection snapshot, a CRM record id). */
  target?: TTarget;
  payload?: Record<string, unknown>;
}

export interface ExecutionResult {
  ok: boolean;
  type: ExecutionType;
  executor: string;
  method?: string;
  message?: string;
}

export interface ActionExecutor<TTarget = unknown> {
  readonly id: string;
  /** Action types this executor can perform. */
  readonly handles: readonly ExecutionType[];
  canExecute(request: ExecutionRequest<TTarget>): boolean;
  execute(request: ExecutionRequest<TTarget>): Promise<ExecutionResult>;
}

/** Dispatches execution requests to the first executor that can handle them. */
export class ExecutorRegistry {
  private readonly executors: ActionExecutor<unknown>[] = [];

  register<T>(executor: ActionExecutor<T>): this {
    this.executors.push(executor as ActionExecutor<unknown>);
    return this;
  }

  find(request: ExecutionRequest<unknown>): ActionExecutor<unknown> | undefined {
    return this.executors.find((e) => e.handles.includes(request.type) && e.canExecute(request));
  }

  supported(request: Omit<ExecutionRequest<unknown>, "text">): ExecutionType[] {
    const types = new Set<ExecutionType>();
    for (const e of this.executors) {
      for (const type of e.handles) {
        if (e.canExecute({ ...request, type, text: "" })) types.add(type);
      }
    }
    return [...types];
  }

  async execute(request: ExecutionRequest<unknown>): Promise<ExecutionResult> {
    const executor = this.find(request);
    if (!executor) {
      return { ok: false, type: request.type, executor: "none", message: `No executor can perform "${request.type}" here.` };
    }
    try {
      return await executor.execute(request);
    } catch (error) {
      return { ok: false, type: request.type, executor: executor.id, message: (error as Error).message };
    }
  }
}
