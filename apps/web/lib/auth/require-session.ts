import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import {
  ACCOUNT_DISABLED_MESSAGE,
  isSessionUserActive,
  isSudoSessionLive,
  recordSudoRequest,
} from "./account-status";
import { requireSessionFromRequest, type SessionPayload } from "./session";

export async function requireSessionOnly(
  request: NextRequest,
): Promise<SessionPayload | ReturnType<typeof errorResponse>> {
  const session = await requireSessionFromRequest(request);
  if (!session) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
  }
  if (!(await isSessionUserActive(session))) {
    return errorResponse(request, {
      status: 403,
      code: "account_disabled",
      message: ACCOUNT_DISABLED_MESSAGE,
    });
  }
  if (session.impersonationId) {
    if (!(await isSudoSessionLive(session))) {
      return errorResponse(request, {
        status: 401,
        code: "sudo_expired",
        message: "Sudo session ended",
      });
    }
    await recordSudoRequest(session, request);
  }
  return session;
}
