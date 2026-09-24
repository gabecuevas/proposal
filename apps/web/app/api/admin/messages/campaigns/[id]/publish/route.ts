import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { publishCampaign } from "@/lib/support/campaigns";
import { isSupportCampaignsEnabled } from "@/lib/support/flags";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  if (!isSupportCampaignsEnabled()) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Not found" });
  }
  const { id } = await params;
  const campaign = await publishCampaign(id);
  return jsonWithRequestId(request, { campaign });
}
