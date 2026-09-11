import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  deleteEmailTemplate,
  getEmailTemplate,
  updateEmailTemplate,
} from "@/lib/crm/email-templates";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { templateId } = await context.params;
    const template = await getEmailTemplate(auth.workspaceId, templateId);
    if (!template) {
      return jsonWithRequestId(request, { error: "Email template not found." }, { status: 404 });
    }
    return jsonWithRequestId(request, { template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load template";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { templateId } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }
    const visibility =
      body.visibility === "SHARED" || body.visibility === "PRIVATE"
        ? body.visibility
        : undefined;
    const template = await updateEmailTemplate(auth.workspaceId, templateId, {
      name: typeof body.name === "string" ? body.name : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : undefined,
      visibility,
    });
    return jsonWithRequestId(request, { template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update template";
    const status = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    const { templateId } = await context.params;
    const deleted = await deleteEmailTemplate(auth.workspaceId, templateId);
    return jsonWithRequestId(request, { ok: true, deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete template";
    const status = message.includes("not found") ? 404 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
