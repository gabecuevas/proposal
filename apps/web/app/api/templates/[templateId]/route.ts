import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { getTemplate, updateTemplate } from "@/lib/editor/template-store";
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
  assertRole(auth, "ADMIN");

  const { templateId } = await params;
  const payload = (await request.json()) as {
    name?: string;
    editor_json?: EditorDoc;
    variable_registry?: VariableRegistry;
    pricing_json?: PricingModel;
  };

  const template = await updateTemplate(templateId, auth.workspaceId, payload);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}
