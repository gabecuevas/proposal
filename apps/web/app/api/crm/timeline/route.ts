import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { listTimeline, timelineToDrawerHistory } from "@/lib/crm/timeline";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contactId") ?? undefined;
  const leadId = url.searchParams.get("leadId") ?? undefined;
  const companyId = url.searchParams.get("companyId") ?? undefined;

  if (!contactId && !leadId && !companyId) {
    return jsonWithRequestId(request, { items: [], history: [] });
  }

  const items = await listTimeline(auth.workspaceId, { contactId, leadId, companyId });
  return jsonWithRequestId(request, {
    items,
    history: timelineToDrawerHistory(items),
  });
}
