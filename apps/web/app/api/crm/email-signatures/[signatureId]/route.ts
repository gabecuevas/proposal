import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { deleteEmailSignature, updateEmailSignature } from "@/lib/crm/email-signatures";

type RouteContext = {
  params: Promise<{ signatureId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { signatureId } = await context.params;
    if (!signatureId?.trim()) {
      return jsonWithRequestId(request, { error: "Signature id is required." }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    const signature = await updateEmailSignature(auth.workspaceId, signatureId.trim(), {
      name: typeof body.name === "string" ? body.name : undefined,
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : undefined,
    });
    return jsonWithRequestId(request, { ok: true, signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update signature";
    const status = message.includes("not found") ? 404 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { signatureId } = await context.params;
    if (!signatureId?.trim()) {
      return jsonWithRequestId(request, { error: "Signature id is required." }, { status: 400 });
    }
    const deleted = await deleteEmailSignature(auth.workspaceId, signatureId.trim());
    return jsonWithRequestId(request, { ok: true, deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete signature";
    const status = message.includes("not found") ? 404 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
