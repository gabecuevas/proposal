import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { logApiEvent } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  logApiEvent(request, {
    event: "health.probe",
    requestId,
    status: 200,
  });
  return jsonWithRequestId(request, {
    ok: true,
    status: "healthy",
    service: "web",
    now: new Date().toISOString(),
  });
}
