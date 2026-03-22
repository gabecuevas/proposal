import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/observability/request-id";
import { logApiEvent } from "@/lib/observability/logger";

export function jsonWithRequestId(
  request: Request,
  body: Record<string, unknown>,
  init?: { status?: number },
) {
  const requestId = getRequestId(request);
  const status = init?.status ?? 200;
  const response = NextResponse.json(
    {
      ...body,
      requestId,
    },
    init,
  );
  response.headers.set("x-request-id", requestId);
  logApiEvent(request, {
    event: "api.response",
    requestId,
    status,
  });
  return response;
}

export function errorResponse(
  request: Request,
  input: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  },
) {
  const response = jsonWithRequestId(
    request,
    {
      error: {
        code: input.code,
        message: input.message,
        details: input.details,
      },
    },
    { status: input.status },
  );
  logApiEvent(request, {
    level: input.status >= 500 ? "error" : "warn",
    event: "api.error",
    requestId: response.headers.get("x-request-id") ?? getRequestId(request),
    status: input.status,
    details: {
      code: input.code,
    },
  });
  return response;
}
