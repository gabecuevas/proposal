import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
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
