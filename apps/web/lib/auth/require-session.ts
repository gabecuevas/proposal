import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
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
  return session;
}
