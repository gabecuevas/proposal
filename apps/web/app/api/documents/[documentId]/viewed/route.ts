import { NextResponse, type NextRequest } from "next/server";
import { getDocumentAccessContext } from "@/lib/auth/document-access";
import { markDocumentViewed } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { documentId } = await params;
  let access;
  try {
    access = await getDocumentAccessContext(request, documentId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => ({}))) as { actorRecipientId?: string };
  const actorRecipientId =
    access.kind === "signing-recipient" ? access.recipientId : payload.actorRecipientId;

  const document = await markDocumentViewed({
    documentId,
    workspaceId: access.workspaceId,
    actorUserId: access.kind === "workspace-user" ? access.userId : undefined,
    actorRecipientId,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}
