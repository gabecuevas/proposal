import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { AccountAdminError, editAccount } from "@/lib/support/account-admin";
import { getPlatformContactDetail } from "@/lib/support/contacts";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { userId } = await params;
  const contact = await getPlatformContactDetail(userId);
  if (!contact) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Contact not found",
    });
  }
  return jsonWithRequestId(request, { contact });
}

type PatchBody = {
  name?: unknown;
  email?: unknown;
  workspaceId?: unknown;
  company?: unknown;
  type?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { userId } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Invalid JSON body",
    });
  }
  const type = body.type === "OWNER" || body.type === "USER" ? body.type : undefined;
  if (body.type !== undefined && !type) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Type must be OWNER or USER",
    });
  }

  try {
    const result = await editAccount(userId, admin.userId, {
      name: optionalString(body.name),
      email: optionalString(body.email),
      workspaceId: optionalString(body.workspaceId),
      company: optionalString(body.company),
      type,
    });
    const contact = await getPlatformContactDetail(userId);
    return jsonWithRequestId(request, { contact, ...result });
  } catch (error) {
    if (error instanceof AccountAdminError) {
      return errorResponse(request, {
        status: error.status,
        code: error.code,
        message: error.message,
      });
    }
    console.error("[admin/contacts] edit failed", error);
    return errorResponse(request, {
      status: 500,
      code: "edit_failed",
      message: "Unable to save changes; nothing was changed",
    });
  }
}
