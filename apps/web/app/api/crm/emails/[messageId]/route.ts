import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { setEmailMessagePinned } from "@/lib/crm/emails";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { messageId } = await context.params;
    if (!messageId?.trim()) {
      return jsonWithRequestId(request, { error: "Missing message id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || typeof body.pinned !== "boolean") {
      return jsonWithRequestId(request, { error: "Expected { pinned: boolean }." }, { status: 400 });
    }

    const message = await setEmailMessagePinned(auth.workspaceId, messageId.trim(), body.pinned);
    if (!message) {
      return jsonWithRequestId(request, { error: "Email not found." }, { status: 404 });
    }

    return jsonWithRequestId(request, { ok: true, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update email";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}
