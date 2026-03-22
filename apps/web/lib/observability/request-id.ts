import type { NextRequest } from "next/server";

type RequestLike = Pick<Request, "headers"> | NextRequest;

export function getRequestId(request: RequestLike): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
