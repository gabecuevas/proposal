import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  getCrmEmailMessage,
  linkCrmEmailMessage,
  setEmailMessagePinned,
  updateCrmEmailMessages,
} from "@/lib/crm/emails";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { messageId } = await context.params;
    if (!messageId?.trim()) {
      return jsonWithRequestId(request, { error: "Missing message id." }, { status: 400 });
    }

    const message = await getCrmEmailMessage(auth.workspaceId, messageId.trim());
    if (!message) {
      return jsonWithRequestId(request, { error: "Email not found." }, { status: 404 });
    }

    if (!message.isRead && message.folder !== "drafts") {
      await updateCrmEmailMessages(auth.workspaceId, [message.id], "markRead");
      message.isRead = true;
    }

    return jsonWithRequestId(request, { message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load email";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { messageId } = await context.params;
    if (!messageId?.trim()) {
      return jsonWithRequestId(request, { error: "Missing message id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof body.pinned === "boolean") {
      const message = await setEmailMessagePinned(auth.workspaceId, messageId.trim(), body.pinned);
      if (!message) {
        return jsonWithRequestId(request, { error: "Email not found." }, { status: 404 });
      }
      return jsonWithRequestId(request, { ok: true, message });
    }

    if (body.contactId !== undefined || body.leadId !== undefined || body.companyId !== undefined) {
      const message = await linkCrmEmailMessage(auth.workspaceId, messageId.trim(), {
        contactId: typeof body.contactId === "string" ? body.contactId : body.contactId === null ? null : undefined,
        leadId: typeof body.leadId === "string" ? body.leadId : body.leadId === null ? null : undefined,
        companyId:
          typeof body.companyId === "string" ? body.companyId : body.companyId === null ? null : undefined,
      });
      if (!message) {
        return jsonWithRequestId(request, { error: "Email not found." }, { status: 404 });
      }
      return jsonWithRequestId(request, { ok: true, message });
    }

    return jsonWithRequestId(request, { error: "No supported update fields." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update email";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}
