import type { InAppCampaignStatus } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { createCampaign, listCampaigns } from "@/lib/support/campaigns";
import { isSupportCampaignsEnabled } from "@/lib/support/flags";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  if (!isSupportCampaignsEnabled()) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Not found",
    });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as InAppCampaignStatus | null;
  const campaigns = await listCampaigns(status ?? undefined);
  return jsonWithRequestId(request, { campaigns });
}

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  if (!isSupportCampaignsEnabled()) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Not found",
    });
  }
  const body = (await request.json()) as {
    title?: string;
    bodyText?: string;
    bodyHtml?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  if (!body.title?.trim() || !body.bodyText?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "title and bodyText are required",
    });
  }
  const campaign = await createCampaign({
    title: body.title,
    bodyText: body.bodyText,
    bodyHtml: body.bodyHtml ?? `<p>${body.bodyText}</p>`,
    ctaLabel: body.ctaLabel ?? null,
    ctaUrl: body.ctaUrl ?? null,
    createdBy: admin.userId,
  });
  return jsonWithRequestId(request, { campaign }, { status: 201 });
}
