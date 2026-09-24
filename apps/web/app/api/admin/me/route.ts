import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { isSupportAdminEnabled } from "@/lib/support/flags";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

export async function GET(request: NextRequest) {
  if (!isSupportAdminEnabled()) {
    return jsonWithRequestId(request, { isPlatformAdmin: false, adminEnabled: false });
  }
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return jsonWithRequestId(request, { isPlatformAdmin: false, adminEnabled: true });
  }
  return jsonWithRequestId(request, {
    isPlatformAdmin: true,
    adminEnabled: true,
    user: { id: admin.userId, email: admin.email, name: admin.name },
  });
}
