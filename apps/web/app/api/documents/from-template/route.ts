import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createDocumentFromTemplate } from "@/lib/editor/document-store";

type RecipientBody = {
  name?: string;
  email?: string;
  contactId?: string | null;
  companyName?: string | null;
};

type FromTemplateBody = {
  templateId?: string;
  title?: string;
  recipient?: RecipientBody;
  recipients?: RecipientBody[];
};

function normalizeRecipients(payload: FromTemplateBody) {
  const list = payload.recipients?.length
    ? payload.recipients
    : payload.recipient
      ? [payload.recipient]
      : [];
  return list
    .map((item) => ({
      name: item.name?.trim() ?? "",
      email: item.email?.trim() ?? "",
      contactId: item.contactId ?? null,
      companyName: item.companyName ?? null,
    }))
    .filter((item) => item.name && item.email);
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const payload = (await request.json()) as FromTemplateBody;
  if (!payload.templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const recipients = normalizeRecipients(payload);
  if ((payload.recipient || payload.recipients) && recipients.length === 0) {
    return NextResponse.json(
      { error: "recipient.name and recipient.email are required" },
      { status: 400 },
    );
  }

  try {
    const document = await createDocumentFromTemplate(payload.templateId, auth.workspaceId, {
      recipients: recipients.length > 0 ? recipients : undefined,
      title: payload.title?.trim() || undefined,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create document";
    if (message === "Template not found" || message === "Contact not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
