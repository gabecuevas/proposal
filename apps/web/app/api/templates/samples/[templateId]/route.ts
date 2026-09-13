import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  deleteSampleTemplate,
  duplicateSampleTemplate,
  updateSampleTemplate,
} from "@/lib/editor/template-store";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    assertRole(auth, "OWNER");
    const { templateId } = await context.params;
    if (!templateId?.trim()) {
      return jsonWithRequestId(request, { error: "Template id is required." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      name?: string;
      duplicate?: boolean;
    } | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    if (body.duplicate) {
      const template = await duplicateSampleTemplate({
        templateId: templateId.trim(),
        workspaceId: auth.workspaceId,
        createdBy: auth.userId,
        name: typeof body.name === "string" ? body.name : undefined,
      });
      if (!template) {
        return jsonWithRequestId(request, { error: "Sample template not found." }, { status: 404 });
      }
      return jsonWithRequestId(request, { ok: true, template }, { status: 201 });
    }

    const template = await updateSampleTemplate(templateId.trim(), {
      name: typeof body.name === "string" ? body.name : undefined,
      updatedBy: auth.userId,
    });
    if (!template) {
      return jsonWithRequestId(request, { error: "Sample template not found." }, { status: 404 });
    }
    return jsonWithRequestId(request, { ok: true, template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update sample template";
    const status =
      message === "Forbidden"
        ? 403
        : message.includes("required")
          ? 400
          : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    assertRole(auth, "OWNER");
    const { templateId } = await context.params;
    if (!templateId?.trim()) {
      return jsonWithRequestId(request, { error: "Template id is required." }, { status: 400 });
    }
    const ok = await deleteSampleTemplate(templateId.trim());
    if (!ok) {
      return jsonWithRequestId(request, { error: "Sample template not found." }, { status: 404 });
    }
    return jsonWithRequestId(request, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete sample template";
    const status = message === "Forbidden" ? 403 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
