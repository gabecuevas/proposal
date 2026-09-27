import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  deleteTemplate,
  duplicateTemplate,
  getSampleTemplate,
  getTemplate,
  setTemplateShares,
  updateSampleTemplateContent,
  updateTemplate,
} from "@/lib/editor/template-store";
import type { EditorDoc, PricingModel, VariableRegistry } from "@/lib/editor/types";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { isPlatformAdminSession } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ templateId: string }> };

async function isPlatformAdminRequest(request: NextRequest): Promise<boolean> {
  return isPlatformAdminSession(await requireSessionFromRequest(request));
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { templateId } = await params;
  const template =
    (await getTemplate(templateId, auth.workspaceId)) ?? (await getSampleTemplate(templateId));
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
    pricing_json?: PricingModel | Record<string, unknown>;
    folder_id?: string | null;
    shareUserIds?: string[];
    duplicate?: boolean;
  };

  const sample = await getSampleTemplate(templateId);
  if (sample) {
    if (!(await isPlatformAdminRequest(request))) {
      return NextResponse.json(
        { error: "Only the platform administrator can edit master templates" },
        { status: 403 },
      );
    }
    if (payload.duplicate || Array.isArray(payload.shareUserIds)) {
      return NextResponse.json(
        { error: "Use the Sample Templates actions for master templates" },
        { status: 400 },
      );
    }
    const template = await updateSampleTemplateContent(templateId, {
      name: payload.name,
      editor_json: payload.editor_json,
      variable_registry: payload.variable_registry,
      pricing_json: payload.pricing_json,
      updatedBy: auth.userId,
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  }

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
  if ((await getSampleTemplate(templateId)) && !(await isPlatformAdminRequest(request))) {
    return NextResponse.json(
      { error: "Only the platform administrator can delete master templates" },
      { status: 403 },
    );
  }
  const ok = await deleteTemplate(templateId, auth.workspaceId);
  if (!ok) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
