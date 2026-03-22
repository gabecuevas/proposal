import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { getDocument } from "@/lib/editor/document-store";
import { signArtifactDownloadToken } from "@/lib/auth/artifact-download";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const document = await getDocument(documentId, auth.workspaceId);
  if (!document || !document.finalized_pdf_key || !document.doc_hash) {
    return NextResponse.json({ error: "Finalized PDF not available" }, { status: 404 });
  }

  const token = await signArtifactDownloadToken({
    documentId: document.id,
    workspaceId: auth.workspaceId,
    pdfKey: document.finalized_pdf_key,
  });
  const downloadUrl = `/api/documents/${document.id}/artifact?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    downloadUrl,
    expiresInSeconds: 60 * 15,
    pdfKey: document.finalized_pdf_key,
    docHash: document.doc_hash,
  });
}
