import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  createOutboundEmail,
  listCrmEmailsPage,
  listEmailsForRecord,
  parseEmailFolder,
  updateCrmEmailMessages,
  type CrmEmailBatchAction,
  type OutboundEmailMode,
} from "@/lib/crm/emails";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBatchAction(value: unknown): CrmEmailBatchAction | null {
  if (value === "markRead" || value === "markUnread" || value === "trash") {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const contactId = request.nextUrl.searchParams.get("contactId");
  const leadId = request.nextUrl.searchParams.get("leadId");
  const companyId = request.nextUrl.searchParams.get("companyId");

  if (contactId || leadId || companyId) {
    const messages = await listEmailsForRecord(auth.workspaceId, {
      contactId,
      leadId,
      companyId,
    });
    return jsonWithRequestId(request, { messages });
  }

  const folder = parseEmailFolder(request.nextUrl.searchParams.get("folder"));
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const offsetRaw = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;
  const { messages, total } = await listCrmEmailsPage(auth.workspaceId, folder, { limit, offset });
  return jsonWithRequestId(request, { folder, messages, total, limit, offset });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    const action = parseBatchAction(body.action);
    if (!action) {
      return jsonWithRequestId(request, { error: "Invalid action." }, { status: 400 });
    }

    const ids = asStringArray(body.ids);
    if (ids.length === 0) {
      return jsonWithRequestId(request, { error: "Select at least one email." }, { status: 400 });
    }

    const updated = await updateCrmEmailMessages(auth.workspaceId, ids, action);
    return jsonWithRequestId(request, { ok: true, updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update emails";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    const modeRaw = typeof body.mode === "string" ? body.mode : "send";
    const mode = (["send", "draft", "schedule"].includes(modeRaw) ? modeRaw : null) as OutboundEmailMode | null;
    if (!mode) {
      return jsonWithRequestId(request, { error: "Invalid mode." }, { status: 400 });
    }

    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    if (!accountId) {
      return jsonWithRequestId(request, { error: "Choose a From account." }, { status: 400 });
    }

    const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];
    const attachments = attachmentsRaw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const row = item as Record<string, unknown>;
        if (
          typeof row.filename !== "string" ||
          typeof row.contentType !== "string" ||
          typeof row.contentBase64 !== "string"
        ) {
          return null;
        }
        return {
          filename: row.filename,
          contentType: row.contentType,
          contentBase64: row.contentBase64,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const message = await createOutboundEmail(auth.workspaceId, {
      accountId,
      mode,
      to: asStringArray(body.to),
      cc: asStringArray(body.cc),
      bcc: asStringArray(body.bcc),
      subject: typeof body.subject === "string" ? body.subject : "",
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : "",
      draftId: typeof body.draftId === "string" ? body.draftId : null,
      contactId: typeof body.contactId === "string" ? body.contactId : null,
      leadId: typeof body.leadId === "string" ? body.leadId : null,
      companyId: typeof body.companyId === "string" ? body.companyId : null,
      scheduleAt: typeof body.scheduleAt === "string" ? body.scheduleAt : null,
      trackOpens: Boolean(body.trackOpens),
      trackClicks: Boolean(body.trackClicks),
      privateSend: Boolean(body.privateSend),
      attachments,
    });

    return jsonWithRequestId(request, {
      ok: true,
      message: {
        id: message.id,
        folder: message.folder,
        subject: message.subject,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send email";
    const status =
      message.includes("not found") || message.includes("not authorized") || message.includes("Add at least")
        ? 400
        : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
