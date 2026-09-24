import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { isSupportMessengerEnabled } from "@/lib/support/flags";

export async function requireSupportCustomer(request: NextRequest) {
  if (!isSupportMessengerEnabled()) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Not found",
    });
  }
  const session = await requireSessionFromRequest(request);
  if (!session) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
  }
  return session;
}

export function isCustomerSessionError(
  value: Awaited<ReturnType<typeof requireSupportCustomer>>,
): value is ReturnType<typeof errorResponse> {
  return !("userId" in value);
}
