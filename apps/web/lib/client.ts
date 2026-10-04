"use client";

/** Tiny fetch wrapper for client components. Throws with the API's error message. */
export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `Request failed (${response.status})`);
  return data as T;
}
