import { NextResponse, type NextRequest } from "next/server";
import { getDocumentAccessContext } from "@/lib/auth/document-access";
import { getDocumentSignerFields } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { documentId } = await params;
  let access;
  try {
    access = await getDocumentAccessContext(request, documentId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fields = await getDocumentSignerFields(documentId, access.workspaceId);
  const filteredFields =
    access.kind === "signing-recipient"
      ? fields.filter((field) => field.recipientId === access.recipientId)
      : fields;
  return NextResponse.json({ fields: filteredFields });
}
