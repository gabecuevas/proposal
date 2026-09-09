import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  setTemplateShares,
  updateTemplate,
} from "@/lib/editor/template-store";
import type { EditorDoc, PricingModel, VariableRegistry } from "@/lib/editor/types";

type Params = { params: Promise<{ templateId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { templateId } = await params;
  const template = await getTemplate(templateId, auth.workspaceId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { templateId } = await params;
  const payload = (await request.json()) as {
    name?: string;
    editor_json?: EditorDoc;
    variable_registry?: VariableRegistry;
    pricing_json?: PricingModel;
    folder_id?: string | null;
    shareUserIds?: string[];
    duplicate?: boolean;
  };

  if (payload.duplicate) {
    const template = await duplicateTemplate({
      templateId,
      workspaceId: auth.workspaceId,
      createdBy: auth.userId,
      name: payload.name,
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template }, { status: 201 });
  }

  if (Array.isArray(payload.shareUserIds)) {
    const template = await setTemplateShares({
      templateId,
      workspaceId: auth.workspaceId,
      userIds: payload.shareUserIds,
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  }

  const template = await updateTemplate(templateId, auth.workspaceId, {
    ...payload,
    updatedBy: auth.userId,
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { templateId } = await params;
  const ok = await deleteTemplate(templateId, auth.workspaceId);
  if (!ok) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
