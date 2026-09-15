import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { parseEmailSyncLookback, syncActiveEmailAccountsForWorkspace } from "@/lib/crm/emails";

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const lookback = parseEmailSyncLookback(body?.lookback);

    const result = await syncActiveEmailAccountsForWorkspace(auth.workspaceId, lookback);
    return jsonWithRequestId(request, { ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sync emails";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}
