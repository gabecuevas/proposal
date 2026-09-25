import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  SESSION_COOKIE_NAME,
  SUDO_ADMIN_COOKIE,
  SUDO_SESSION_MAX_AGE,
  signSessionToken,
} from "@/lib/auth/session";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import { postAuthRedirectPath } from "@/lib/auth/session-builder";
import { AccountAdminError, startSudoSession } from "@/lib/support/account-admin";
import { isErrorResponse, requireEnvPlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const admin = await requireEnvPlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const adminToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!adminToken) {
    return errorResponse(request, { status: 401, code: "unauthorized", message: "Unauthorized" });
  }
  const { userId } = await params;

  try {
    const payload = await startSudoSession({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      targetUserId: userId,
    });
    const token = await signSessionToken(payload);
    const response = jsonWithRequestId(request, {
      ok: true,
      redirectHint: postAuthRedirectPath(payload, "/app"),
    });
    applySessionCookie(response, token, SUDO_SESSION_MAX_AGE);
    response.cookies.set(SUDO_ADMIN_COOKIE, adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SUDO_SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof AccountAdminError) {
      return errorResponse(request, {
        status: error.status,
        code: error.code,
        message: error.message,
      });
    }
    console.error("[admin/sudo] start failed", error);
    return errorResponse(request, {
      status: 500,
      code: "sudo_failed",
      message: "Unable to start sudo session",
    });
  }
}
