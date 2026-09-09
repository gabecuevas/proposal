import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  deleteDocument,
  getDocument,
  isManualDocumentStatus,
  SentDocumentImmutableError,
  updateDocumentDraft,
  updateDocumentStatus,
} from "@/lib/editor/document-store";
import { StaleDocumentWriteError } from "@/lib/editor/save-queue";
import type { EditorDoc, PricingModel, VariableContext } from "@/lib/editor/types";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const document = await getDocument(documentId, auth.workspaceId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ document });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const payload = (await request.json()) as {
    editor_json?: EditorDoc;
    variables_json?: VariableContext;
    pricing_json?: PricingModel;
    recipients_json?: Array<{ id: string; email: string; name: string; role: "signer" | "approver" | "viewer" }>;
    contact_id?: string | null;
    expectedUpdatedAt?: string;
    status?: string;
  };

  if (typeof payload.status === "string") {
    if (!isManualDocumentStatus(payload.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    try {
      const document = await updateDocumentStatus(documentId, auth.workspaceId, payload.status);
      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const document = await updateDocumentDraft(documentId, auth.workspaceId, payload);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof StaleDocumentWriteError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    if (error instanceof SentDocumentImmutableError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to update document";
    if (message === "Contact not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { documentId } = await params;
  const deleted = await deleteDocument(documentId, auth.workspaceId);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
