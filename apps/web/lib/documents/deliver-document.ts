import { prisma } from "@repo/db";
import { isCommercialDocument } from "@/lib/commercial/schema";
import { documentKindFromVariables, documentKindProfile } from "@/lib/editor/document-kind";
import type { DocumentRecord } from "@/lib/editor/document-store";
import { enqueueMail, processPendingMail } from "@/lib/mail/outbox";
import { documentTitleFromEditorJson } from "@/lib/ui/document-title";
import { deliveryContext, documentDeliveryEmail } from "./delivery-message";
import { publicDocumentUrl } from "./public-link";

export function documentDisplayTitle(document: Pick<DocumentRecord, "pricing_json" | "editor_json" | "variables_json">): string {
  const pricing: unknown = document.pricing_json;
  if (isCommercialDocument(pricing) && pricing.internalName?.trim()) {
    return pricing.internalName.trim();
  }
  const profile = documentKindProfile(documentKindFromVariables(document.variables_json));
  return documentTitleFromEditorJson(document.editor_json, profile.blankTitle);
}

/** Email each recipient the delivery message with the view-only public link. */
export async function enqueueDocumentDeliveryEmails(input: {
  document: DocumentRecord;
  senderUserId: string;
  subject: string;
  message: string;
  origin: string;
}): Promise<number> {
  const { document } = input;
  const link = publicDocumentUrl(document.id, input.origin);
  const title = documentDisplayTitle(document);
  const noun = documentKindProfile(documentKindFromVariables(document.variables_json)).noun;
  const sender = await prisma.user.findUnique({
    where: { id: input.senderUserId },
    select: { email: true },
  });
  const variables = (document.variables_json ?? {}) as Record<string, unknown>;

  let queued = 0;
  for (const recipient of document.recipients_json ?? []) {
    const email = recipient.email?.trim();
    if (!email) {
      continue;
    }
    const mail = documentDeliveryEmail({
      subject: input.subject,
      message: input.message,
      context: deliveryContext({ variables, recipient: { name: recipient.name ?? "", email }, link, title }),
      link,
      noun,
    });
    await enqueueMail({
      toEmail: email,
      subject: mail.subject,
      htmlBody: mail.html,
      textBody: mail.text,
      purpose: "document_delivery",
      idempotencyKey: `document-delivery:${document.id}:${email.toLowerCase()}`,
      sensitivePayload: sender?.email ? JSON.stringify({ replyTo: sender.email }) : null,
    });
    queued += 1;
  }
  if (queued > 0) {
    void processPendingMail().catch(() => undefined);
  }
  return queued;
}
