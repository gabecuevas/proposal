import { prisma } from "@repo/db";
import { isEmptyNoteHtml, isNoteOverLimit, normalizeNoteHtml } from "@/lib/crm/notes-html";
import { writeTimelineEvent } from "@/lib/crm/timeline";
import { userDisplayName } from "@/lib/crm/display-name";
import type { EditorDoc } from "@/lib/editor/types";
import {
  documentSenderFromEditorJson,
  documentTitleFromEditorJson,
} from "@/lib/ui/document-title";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSentTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function appendNoteHtml(existing: string | null | undefined, entryHtml: string): string {
  const current = normalizeNoteHtml(existing ?? "");
  if (!current) {
    return entryHtml;
  }
  return `${current}${entryHtml}`;
}

export function buildDocumentSentNoteHtml(input: {
  documentId: string;
  title: string;
  senderName: string;
  recipientNames: string[];
  sentAt: Date;
}): { html: string; summary: string } {
  const title = input.title.trim() || "Untitled document";
  const sender = input.senderName.trim() || "Unknown sender";
  const recipients =
    input.recipientNames.map((name) => name.trim()).filter(Boolean).join(", ") || "Unknown recipient";
  const when = formatSentTimestamp(input.sentAt);
  const href = `/app/documents/${encodeURIComponent(input.documentId)}`;
  const summary = `Document Sent: ${title} by ${sender} to ${recipients} on ${when}`;
  const html = `<p>Document Sent: <a href="${href}">${escapeHtml(title)}</a> by ${escapeHtml(sender)} to ${escapeHtml(recipients)} on ${escapeHtml(when)}</p>`;
  return { html, summary };
}

/**
 * After a document is sent, append a CRM note on each linked Person and Company,
 * and write a History Log (NOTE_SAVED) entry with the same message + document link.
 */
export async function recordDocumentSentInCrm(input: {
  workspaceId: string;
  actorUserId: string;
  documentId: string;
  editorJson: EditorDoc;
  contactId?: string | null;
  recipients: Array<{
    name?: string | null;
    email?: string | null;
    contact_id?: string | null;
    id?: string | null;
  }>;
  sentAt?: Date;
}): Promise<void> {
  const sentAt = input.sentAt ?? new Date();
  const title = documentTitleFromEditorJson(input.editorJson, input.documentId);
  const actor = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    select: { name: true, email: true },
  });
  const senderFromDoc = documentSenderFromEditorJson(input.editorJson);
  const senderName = senderFromDoc || (actor ? userDisplayName(actor) : "") || "Unknown sender";
  const recipientNames = input.recipients
    .map((item) => item.name?.trim() || item.email?.trim() || "")
    .filter(Boolean);

  const { html: noteHtml, summary } = buildDocumentSentNoteHtml({
    documentId: input.documentId,
    title,
    senderName,
    recipientNames,
    sentAt,
  });

  const contactIds = new Set<string>();
  if (input.contactId) {
    contactIds.add(input.contactId);
  }
  for (const recipient of input.recipients) {
    if (recipient.contact_id) {
      contactIds.add(recipient.contact_id);
    }
  }

  if (contactIds.size === 0) {
    return;
  }

  const contacts = await prisma.contact.findMany({
    where: { workspace_id: input.workspaceId, id: { in: [...contactIds] } },
    select: { id: true, notes: true, company_id: true },
  });
  if (contacts.length === 0) {
    return;
  }

  const companyIds = [
    ...new Set(contacts.map((contact) => contact.company_id).filter(Boolean)),
  ] as string[];
  const companies =
    companyIds.length > 0
      ? await prisma.company.findMany({
          where: { workspace_id: input.workspaceId, id: { in: companyIds } },
          select: { id: true, notes: true },
        })
      : [];

  for (const contact of contacts) {
    const nextNotes = appendNoteHtml(contact.notes, noteHtml);
    if (isNoteOverLimit(nextNotes)) {
      // Still record history even if the notes field is at capacity.
      await writeTimelineEvent({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        contactId: contact.id,
        eventType: "NOTE_SAVED",
        fieldKey: "notes",
        fieldLabel: "Notes",
        summary,
        newValue: noteHtml,
      });
      continue;
    }
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        notes: isEmptyNoteHtml(nextNotes) ? null : nextNotes,
        last_activity_at: new Date(),
      },
    });
    await writeTimelineEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      contactId: contact.id,
      eventType: "NOTE_SAVED",
      fieldKey: "notes",
      fieldLabel: "Notes",
      summary,
      newValue: noteHtml,
    });
  }

  for (const company of companies) {
    const nextNotes = appendNoteHtml(company.notes, noteHtml);
    if (isNoteOverLimit(nextNotes)) {
      await writeTimelineEvent({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        companyId: company.id,
        eventType: "NOTE_SAVED",
        fieldKey: "notes",
        fieldLabel: "Notes",
        summary,
        newValue: noteHtml,
      });
      continue;
    }
    await prisma.company.update({
      where: { id: company.id },
      data: {
        notes: isEmptyNoteHtml(nextNotes) ? null : nextNotes,
      },
    });
    await writeTimelineEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      companyId: company.id,
      eventType: "NOTE_SAVED",
      fieldKey: "notes",
      fieldLabel: "Notes",
      summary,
      newValue: noteHtml,
    });
  }
}
