import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { logApiEvent } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { checkWebReadiness } from "@/lib/observability/readiness";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const readiness = await checkWebReadiness();
  const status = readiness.ready ? 200 : 503;
  logApiEvent(request, {
    level: readiness.ready ? "info" : "warn",
    event: "readiness.probe",
    requestId,
    status,
    details: {
      dbReady: readiness.dbReady,
      redisReady: readiness.redisReady,
    },
  });
  return jsonWithRequestId(
    request,
    {
      ok: readiness.ready,
      status: readiness.ready ? "ready" : "not_ready",
      service: "web",
      checks: {
        db: readiness.dbReady ? "ok" : "fail",
        redis: readiness.redisReady ? "ok" : "fail",
      },
      now: new Date().toISOString(),
    },
    { status },
  );
}
