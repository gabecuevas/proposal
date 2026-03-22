import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { addDocumentComment } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const payload = (await request.json()) as { message?: string };
  const message = payload.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const document = await addDocumentComment({
    documentId,
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    message,
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}
