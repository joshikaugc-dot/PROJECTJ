import { NextResponse } from "next/server";
import { z } from "zod";
import { AIProviderError } from "@contextos/ai";
import { SkillInputError } from "@contextos/verticals";
import { WorkflowError } from "@contextos/workflows";
import type { ApiErrorBody } from "@contextos/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    const message = error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return NextResponse.json({ error: { code: "invalid_request", message } }, { status: 400 });
  }
  if (error instanceof SkillInputError) {
    return NextResponse.json({ error: { code: "missing_input", message: error.message } }, { status: 400 });
  }
  if (error instanceof AIProviderError) {
    // Upstream model failures are a bad gateway from the client's point of view.
    return NextResponse.json({ error: { code: "ai_provider_error", message: error.message } }, { status: 502 });
  }
  if (error instanceof WorkflowError) {
    return NextResponse.json({ error: { code: "workflow_error", message: error.message } }, { status: 502 });
  }
  console.error("[api] unexpected error", error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/** Wrap a route handler with uniform error handling. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON");
  }
}
