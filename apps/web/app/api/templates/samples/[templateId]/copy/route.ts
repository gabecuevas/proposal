import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { copySampleTemplateToLibrary } from "@/lib/editor/template-store";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getRequestAuthContext(request);
    assertRole(auth, "MEMBER");
    const { templateId } = await context.params;
    if (!templateId?.trim()) {
      return jsonWithRequestId(request, { error: "Template id is required." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const template = await copySampleTemplateToLibrary({
      templateId: templateId.trim(),
      workspaceId: auth.workspaceId,
      createdBy: auth.userId,
      name: typeof body.name === "string" ? body.name : undefined,
    });
    if (!template) {
      return jsonWithRequestId(request, { error: "Sample template not found." }, { status: 404 });
    }
    return jsonWithRequestId(request, { ok: true, template }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not copy sample template";
    const status = message === "Forbidden" ? 403 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
