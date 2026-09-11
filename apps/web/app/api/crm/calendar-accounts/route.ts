import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { listCalendarAccounts } from "@/lib/crm/calendar-accounts";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const accounts = await listCalendarAccounts(auth.workspaceId, auth.userId);
    return jsonWithRequestId(request, { accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load calendar accounts";
    return jsonWithRequestId(request, { error: message, accounts: [] }, { status: 500 });
  }
}
