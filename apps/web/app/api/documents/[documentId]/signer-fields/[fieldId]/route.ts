import { NextResponse, type NextRequest } from "next/server";
import { setSignerFieldValue } from "@/lib/editor/document-store";
import { getDocumentAccessContext } from "@/lib/auth/document-access";

type Params = { params: Promise<{ documentId: string; fieldId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { documentId, fieldId } = await params;
  let access;
  try {
    access = await getDocumentAccessContext(request, documentId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json()) as {
    actorRecipientId?: string;
    value?: string | boolean;
  };
  const actorRecipientId =
    access.kind === "signing-recipient" ? access.recipientId : payload.actorRecipientId;
  if (!actorRecipientId) {
    return NextResponse.json({ error: "actorRecipientId is required" }, { status: 400 });
  }

  try {
    const values = await setSignerFieldValue({
      documentId,
      workspaceId: access.workspaceId,
      fieldId,
      actorRecipientId,
      value: payload.value ?? "",
    });

    return NextResponse.json({ values });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update signer field";
    if (
      message.includes("not allowed") ||
      message.includes("before earlier signing order") ||
      message.includes("not assigned")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
