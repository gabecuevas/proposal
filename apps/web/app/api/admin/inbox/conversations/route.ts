import type { SupportConversationStatus } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { createConversation, listAdminConversations } from "@/lib/support/conversations";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as SupportConversationStatus | null;
  const assignee = url.searchParams.get("assignee");
  const search = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  const result = await listAdminConversations({
    status: status ?? undefined,
    assigneeAdminId: assignee === "unassigned" ? null : assignee ?? undefined,
    search,
    page,
    pageSize,
  });
  return jsonWithRequestId(request, result);
}

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const body = (await request.json()) as {
    customerUserId?: string;
    subject?: string;
    message?: string;
    workspaceId?: string;
  };
  if (!body.customerUserId?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "customerUserId is required",
    });
  }
  const conversation = await createConversation({
    customerUserId: body.customerUserId.trim(),
    workspaceId: body.workspaceId ?? null,
    subject: body.subject?.trim() || "Support",
    initialBody: body.message,
    senderUserId: admin.userId,
  });
  return jsonWithRequestId(request, { conversation }, { status: 201 });
}
