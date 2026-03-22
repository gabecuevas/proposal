import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { getRequestId } from "@/lib/observability/request-id";
import { replayWebhookDelivery } from "@/lib/webhooks/queue";

type Params = { params: Promise<{ deliveryId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const { deliveryId } = await params;
  try {
    const jobId = await replayWebhookDelivery({
      deliveryId,
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      correlationId: requestId,
    });
    return jsonWithRequestId(request, { ok: true, jobId, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to replay webhook delivery";
    const status = message === "Webhook delivery not found" ? 404 : 500;
    return errorResponse(request, {
      status,
      code: message === "Webhook delivery not found" ? "delivery_not_found" : "webhook_replay_failed",
      message,
      details: { requestId },
    });
  }
}
