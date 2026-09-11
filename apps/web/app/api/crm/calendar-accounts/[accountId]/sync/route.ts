import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { syncGoogleCalendarAccount } from "@/lib/crm/calendar-accounts";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { accountId } = await context.params;
    if (!accountId?.trim()) {
      return jsonWithRequestId(request, { error: "Account id is required." }, { status: 400 });
    }
    const result = await syncGoogleCalendarAccount(auth.workspaceId, auth.userId, accountId.trim());
    return jsonWithRequestId(request, { ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sync Google Calendar";
    const status =
      message.includes("not found") || message.includes("Connect") || message.includes("expired")
        ? 400
        : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
