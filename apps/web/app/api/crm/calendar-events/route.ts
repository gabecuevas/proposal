import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { listCalendarEvents } from "@/lib/crm/calendar-accounts";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const fromRaw = request.nextUrl.searchParams.get("from");
    const toRaw = request.nextUrl.searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : new Date();
    const to = toRaw ? new Date(toRaw) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return jsonWithRequestId(request, { error: "Invalid from/to range." }, { status: 400 });
    }
    const events = await listCalendarEvents(auth.workspaceId, auth.userId, { from, to });
    return jsonWithRequestId(request, { events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load calendar events";
    return jsonWithRequestId(request, { error: message, events: [] }, { status: 500 });
  }
}
