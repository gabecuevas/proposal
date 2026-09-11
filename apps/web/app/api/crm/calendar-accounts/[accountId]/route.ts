import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  disconnectCalendarAccount,
  serializeCalendarAccount,
  updateCalendarAccount,
} from "@/lib/crm/calendar-accounts";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { accountId } = await context.params;
    if (!accountId?.trim()) {
      return jsonWithRequestId(request, { error: "Account id is required." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    const account = await updateCalendarAccount(auth.workspaceId, auth.userId, accountId.trim(), {
      eventColor: typeof body.eventColor === "string" ? body.eventColor : undefined,
    });

    return jsonWithRequestId(request, {
      ok: true,
      account: serializeCalendarAccount(account),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update calendar account";
    const status =
      message.includes("not found") ? 404 : message.includes("hex color") ? 400 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { accountId } = await context.params;
    if (!accountId?.trim()) {
      return jsonWithRequestId(request, { error: "Account id is required." }, { status: 400 });
    }
    const disconnected = await disconnectCalendarAccount(
      auth.workspaceId,
      auth.userId,
      accountId.trim(),
    );
    return jsonWithRequestId(request, { ok: true, disconnected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not disconnect calendar";
    const status = message.includes("not found") ? 404 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
