import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getCampaign, updateCampaign } from "@/lib/support/campaigns";
import { isSupportCampaignsEnabled } from "@/lib/support/flags";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  if (!isSupportCampaignsEnabled()) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Not found" });
  }
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Not found" });
  }
  return jsonWithRequestId(request, { campaign });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  if (!isSupportCampaignsEnabled()) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Not found" });
  }
  const { id } = await params;
  const body = (await request.json()) as {
    title?: string;
    bodyText?: string;
    bodyHtml?: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
  };
  const campaign = await updateCampaign(id, {
    title: body.title,
    bodyText: body.bodyText,
    bodyHtml: body.bodyHtml,
    ctaLabel: body.ctaLabel,
    ctaUrl: body.ctaUrl,
  });
  return jsonWithRequestId(request, { campaign });
}
