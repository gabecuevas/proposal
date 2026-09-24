import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import {
  listUserCampaignDeliveries,
  markCampaignClicked,
  markCampaignViewed,
} from "@/lib/support/campaigns";
import { isCustomerSessionError, requireSupportCustomer } from "@/lib/support/customer-api";
import { isSupportCampaignsEnabled } from "@/lib/support/flags";
import { errorResponse } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const session = await requireSupportCustomer(request);
  if (isCustomerSessionError(session)) {
    return session;
  }
  if (!isSupportCampaignsEnabled()) {
    return jsonWithRequestId(request, { deliveries: [] });
  }
  const deliveries = await listUserCampaignDeliveries(session.userId);
  return jsonWithRequestId(request, { deliveries });
}

export async function POST(request: NextRequest) {
  const session = await requireSupportCustomer(request);
  if (isCustomerSessionError(session)) {
    return session;
  }
  if (!isSupportCampaignsEnabled()) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Not found",
    });
  }
  const body = (await request.json()) as {
    deliveryId?: string;
    action?: "view" | "click";
  };
  if (!body.deliveryId || (body.action !== "view" && body.action !== "click")) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "deliveryId and action required",
    });
  }
  const row =
    body.action === "view"
      ? await markCampaignViewed(body.deliveryId, session.userId)
      : await markCampaignClicked(body.deliveryId, session.userId);
  if (!row) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Delivery not found",
    });
  }
  return jsonWithRequestId(request, { ok: true });
}
