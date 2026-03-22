import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createDocumentFromTemplate } from "@/lib/editor/document-store";

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const payload = (await request.json()) as { templateId?: string };
  if (!payload.templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const document = await createDocumentFromTemplate(payload.templateId, auth.workspaceId);
  return NextResponse.json({ document }, { status: 201 });
}
