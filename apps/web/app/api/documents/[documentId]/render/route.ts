import { NextResponse, type NextRequest } from "next/server";
import { getDocumentAccessContext } from "@/lib/auth/document-access";
import { renderDocumentHtml } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { documentId } = await params;
  let access;
  try {
    access = await getDocumentAccessContext(request, documentId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const mode = (searchParams.get("mode") ?? "sender-preview") as
    | "sender-preview"
    | "recipient-fill"
    | "finalized";
  const recipientIdFromQuery = searchParams.get("recipientId") ?? undefined;
  const recipientId =
    access.kind === "signing-recipient" ? access.recipientId : recipientIdFromQuery;
  if (access.kind === "signing-recipient" && mode === "sender-preview") {
    return NextResponse.json({ error: "Forbidden for signing session" }, { status: 403 });
  }

  const output = await renderDocumentHtml({
    documentId,
    workspaceId: access.workspaceId,
    mode,
    recipientId,
  });
  return NextResponse.json(output);
}
