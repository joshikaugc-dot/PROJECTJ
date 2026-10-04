import type {
  AppContext,
  BootstrapResponse,
  ExecutionActionType,
  RecommendResponse,
  RunRequest,
  RunResponse,
} from "@contextos/shared/client";
import { API_URL } from "./config";
import { getToken } from "./storage";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiClientError(401, "signed_out", "Connect ContextOS to your account.");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiClientError(0, "network", `Can't reach ContextOS at ${API_URL}. Is the server running?`);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      data.error?.code ?? "error",
      data.error?.message ?? `Request failed (${response.status})`,
    );
  }
  return data as T;
}

/** Typed client for the ContextOS /api/v1 surface. */
export const api = {
  bootstrap: () => request<BootstrapResponse>("/api/v1/bootstrap"),
  recommend: (appContext: AppContext, verticalId?: string) =>
    request<RecommendResponse>("/api/v1/recommendations", { method: "POST", body: { appContext, verticalId } }),
  run: (body: RunRequest, signal?: AbortSignal) =>
    request<RunResponse>("/api/v1/run", { method: "POST", body, signal }),
  markExecuted: (actionRecordId: string, type: ExecutionActionType) =>
    request<{ ok: true }>(`/api/v1/actions/${actionRecordId}`, { method: "POST", body: { type } }),
};
