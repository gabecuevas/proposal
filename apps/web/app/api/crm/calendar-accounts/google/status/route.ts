import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { isGoogleCalendarOAuthConfigured } from "@/lib/crm/google-calendar-oauth";

export async function GET(request: NextRequest) {
  return jsonWithRequestId(request, {
    configured: isGoogleCalendarOAuthConfigured(),
  });
}
