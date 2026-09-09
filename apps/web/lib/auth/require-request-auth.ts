import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { getRequestAuthContext, type RequestAuthContext } from "./request-context";

export async function requireRequestAuth(
  request: NextRequest,
): Promise<RequestAuthContext | ReturnType<typeof errorResponse>> {
  try {
    return await getRequestAuthContext(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    if (message === "Forbidden") {
      return errorResponse(request, { status: 403, code: "forbidden", message: "Forbidden" });
    }
    return errorResponse(request, { status: 401, code: "unauthorized", message: "Unauthorized" });
  }
}
