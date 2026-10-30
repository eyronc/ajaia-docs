import { NextResponse } from "next/server";
import type { Failure } from "./repo";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const unauthorized = (): NextResponse => errorResponse("Please sign in.", 401);

const STATUS_BY_FAILURE: Record<Failure, number> = {
  not_found: 404,
  user_not_found: 404,
  forbidden: 403,
  conflict: 409,
  invalid: 400,
};

export function failureResponse(failure: Failure, message: string): NextResponse {
  return errorResponse(message, STATUS_BY_FAILURE[failure]);
}

// Returns null when the body is missing or is not a JSON object.
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}
