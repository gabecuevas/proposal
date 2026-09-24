import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { runSupportJobBatch } from "@/lib/support/jobs";
import { processPendingMail } from "@/lib/mail/outbox";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return errorResponse(request, {
      status: 503,
      code: "not_configured",
      message: "CRON_SECRET is not configured",
    });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "10")));
  const jobs = await runSupportJobBatch(limit);
  const { evaluateOngoingCampaigns } = await import("@/lib/support/campaigns");
  const campaigns = await evaluateOngoingCampaigns();
  const mail = await processPendingMail(20);
  return jsonWithRequestId(request, { jobs, campaigns, mail });
}
