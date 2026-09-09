import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { isGoogleEmailOAuthConfigured } from "@/lib/crm/google-email-oauth";

export async function GET(request: NextRequest) {
  try {
    await getRequestAuthContext(request);
  } catch {
    return jsonWithRequestId(request, { error: "Unauthorized" }, { status: 401 });
  }

  return jsonWithRequestId(request, {
    configured: isGoogleEmailOAuthConfigured(),
    provider: "GOOGLE",
  });
}
