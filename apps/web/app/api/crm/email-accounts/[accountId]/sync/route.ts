import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { parseEmailSyncLookback, syncPastEmailsForAccount } from "@/lib/crm/emails";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { accountId } = await context.params;
    if (!accountId?.trim()) {
      return jsonWithRequestId(request, { error: "Account id is required." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const lookback = parseEmailSyncLookback(body?.lookback);

    const result = await syncPastEmailsForAccount(auth.workspaceId, accountId.trim(), lookback);
    return jsonWithRequestId(request, { ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sync past emails";
    const status =
      message.includes("not found") || message.includes("Connect") || message.includes("available for")
        ? 400
        : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
