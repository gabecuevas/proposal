import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import { randomUUID } from "node:crypto";
import {
  CURRENT_DOC_VERSION,
  type EditorDoc,
  type PricingModel,
  type SignerFieldValue,
  type VariableContext,
} from "./types";
import { defaultPricingModel } from "./defaults";
import { getDiscountPercent, requiresQuoteApproval } from "../cpq/approval";
import { computeDocumentHash } from "./hash";
import { renderComputedHtml } from "./render";
import { applySignerFieldValue, canRecipientFillField } from "./signer-fields";
import { normalizeEditorDoc } from "./stable";
import { resolveTemplateVariables } from "./variables";

export type DocumentRecord = {
  id: string;
  template_id: string | null;
  contact_id: string | null;
  editor_json: EditorDoc;
  variables_json: VariableContext;
  pricing_json: PricingModel;
  recipients_json: Array<{ id: string; email: string; name: string; role: "signer" | "approver" | "viewer" }>;
  doc_hash: string | null;
  finalized_pdf_key: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type DocumentStatus =
  | "DRAFTED"
  | "SENT"
  | "VIEWED"
  | "COMMENTED"
  | "SIGNED"
  | "PAID"
  | "EXPIRED"
  | "VOID";

export type DocumentActivityRecord = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_recipient_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type QuoteApprovalRecord = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_by_user_id: string;
  requested_reason: string | null;
  decided_by_user_id: string | null;
  decided_reason: string | null;
  discount_percent: number;
  threshold_percent: number;
  created_at: string;
  decided_at: string | null;
};

export class QuoteApprovalRequiredError extends Error {
  readonly code = "QUOTE_APPROVAL_REQUIRED";
  constructor(message: string) {
    super(message);
    this.name = "QuoteApprovalRequiredError";
  }
}

function parseQuoteApproval(row: {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_by_user_id: string;
  requested_reason: string | null;
  decided_by_user_id: string | null;
  decided_reason: string | null;
  discount_percent: number;
  threshold_percent: number;
  created_at: Date;
  decided_at: Date | null;
}): QuoteApprovalRecord {
  return {
    id: row.id,
    status: row.status,
    requested_by_user_id: row.requested_by_user_id,
    requested_reason: row.requested_reason,
    decided_by_user_id: row.decided_by_user_id,
    decided_reason: row.decided_reason,
    discount_percent: row.discount_percent,
    threshold_percent: row.threshold_percent,
    created_at: row.created_at.toISOString(),
    decided_at: row.decided_at?.toISOString() ?? null,
  };
}

function parseDocument(row: {
  id: string;
  template_id: string | null;
  contact_id: string | null;
  editor_json: unknown;
  variables_json: unknown;
  pricing_json: unknown;
  recipients_json: unknown;
  doc_hash: string | null;
  finalized_pdf_key: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): DocumentRecord {
  return {
    id: row.id,
    template_id: row.template_id,
    contact_id: row.contact_id,
    editor_json: normalizeEditorDoc(row.editor_json as EditorDoc),
    variables_json: (row.variables_json as VariableContext) ?? {},
    pricing_json: (row.pricing_json as PricingModel) ?? defaultPricingModel,
    recipients_json:
      (row.recipients_json as Array<{
        id: string;
        email: string;
        name: string;
        role: "signer" | "approver" | "viewer";
      }>) ?? [],
    doc_hash: row.doc_hash,
    finalized_pdf_key: row.finalized_pdf_key,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function parseActivityEvent(row: {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_recipient_id: string | null;
  metadata_json: unknown;
  created_at: Date;
}): DocumentActivityRecord {
  return {
    id: row.id,
    event_type: row.event_type,
    actor_user_id: row.actor_user_id,
    actor_recipient_id: row.actor_recipient_id,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: row.created_at.toISOString(),
  };
}

function collectSignerRecipientIds(doc: EditorDoc): string[] {
  const recipientIds = new Set<string>();
  const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (node.type === "signerField" && typeof node.attrs?.recipientId === "string") {
      recipientIds.add(node.attrs.recipientId);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] });
      }
    }
  };
  walk(doc);
  return [...recipientIds];
}

function remapSignerRecipientIds(
  doc: EditorDoc,
  recipientMap: Record<string, string>,
): EditorDoc {
  const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    const nextNode = { ...node };
    if (nextNode.type === "signerField" && typeof nextNode.attrs?.recipientId === "string") {
      nextNode.attrs = {
        ...nextNode.attrs,
        recipientId: recipientMap[nextNode.attrs.recipientId] ?? nextNode.attrs.recipientId,
      };
    }
    if (Array.isArray(nextNode.content)) {
      nextNode.content = nextNode.content.map((child) =>
        walk(child as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }),
      );
    }
    return nextNode;
  };

  return walk(doc) as EditorDoc;
}

export async function createDocumentFromTemplate(
  templateId: string,
  workspaceId: string,
): Promise<DocumentRecord> {
  const template = await prisma.template.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
  });
  if (!template) {
    throw new Error("Template not found");
  }

  const templateDoc = normalizeEditorDoc(template.editor_json as EditorDoc);
  const logicalRecipientIds = collectSignerRecipientIds(templateDoc);
  const fallbackRecipientIds = ["recipient-primary", "recipient-finance"];
  const recipientKeys = logicalRecipientIds.length > 0 ? logicalRecipientIds : fallbackRecipientIds;

  const recipientMap = recipientKeys.reduce<Record<string, string>>((acc, key) => {
    acc[key] = `${key}-${randomUUID()}`;
    return acc;
  }, {});

  const normalizedDoc = remapSignerRecipientIds(templateDoc, recipientMap);

  const recipients = recipientKeys.map((key, index) => ({
    id: recipientMap[key],
    key,
    email: `${key}@example.com`,
    name: key
      .replaceAll("-", " ")
      .replaceAll(/\b\w/g, (letter) => letter.toUpperCase()),
    role: "signer" as const,
    signing_order: index + 1,
  }));

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        workspace_id: workspaceId,
        template_id: template.id,
        editor_json: normalizedDoc as InputJsonValue,
        schema_version: CURRENT_DOC_VERSION,
        doc_version: CURRENT_DOC_VERSION,
        status: "DRAFTED",
        variables_json: {},
        pricing_json: (template.pricing_json ?? defaultPricingModel) as InputJsonValue,
        recipients_json: recipients,
        recipients: {
          create: recipients.map((recipient) => ({
            id: recipient.id,
            email: recipient.email,
            name: recipient.name,
            role: "SIGNER",
            signing_order: recipient.signing_order,
            group_key: null,
          })),
        },
      },
    });

    await tx.documentActivityEvent.create({
      data: {
        workspace_id: workspaceId,
        document_id: created.id,
        event_type: "DOCUMENT_CREATED",
        metadata_json: {
          templateId: template.id,
          recipientCount: recipients.length,
        },
      },
    });

    return created;
  });

  return parseDocument(row);
}

export async function listDocuments(
  workspaceId: string,
  options?: { limit?: number; before?: Date; status?: DocumentStatus; query?: string },
): Promise<DocumentRecord[]> {
  const query = options?.query?.trim();
  const rows = await prisma.document.findMany({
    where: {
      workspace_id: workspaceId,
      updated_at: options?.before ? { lt: options.before } : undefined,
      status: options?.status,
      OR: query
        ? [{ id: { contains: query, mode: "insensitive" } }, { template_id: { contains: query, mode: "insensitive" } }]
        : undefined,
    },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
  });

  return rows.map(parseDocument);
}

export async function createBlankDocument(input: {
  workspaceId: string;
  actorUserId: string;
}): Promise<DocumentRecord> {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        workspace_id: input.workspaceId,
        template_id: null,
        editor_json: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Untitled document" }] }],
        } as InputJsonValue,
        schema_version: CURRENT_DOC_VERSION,
        doc_version: CURRENT_DOC_VERSION,
        status: "DRAFTED",
        variables_json: {},
        pricing_json: defaultPricingModel as InputJsonValue,
        recipients_json: [],
      },
    });
    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: created.id,
        event_type: "DOCUMENT_CREATED",
        actor_user_id: input.actorUserId,
        metadata_json: {
          source: "blank",
        },
      },
    });
    return created;
  });
  return parseDocument(row);
}

export async function getDocument(
  documentId: string,
  workspaceId: string,
): Promise<DocumentRecord | null> {
  const row = await prisma.document.findFirst({
    where: {
      id: documentId,
      workspace_id: workspaceId,
    },
  });
  if (!row) {
    return null;
  }
  return parseDocument(row);
}

export async function updateDocumentDraft(
  documentId: string,
  workspaceId: string,
  input: {
    editor_json?: EditorDoc;
    variables_json?: VariableContext;
    pricing_json?: PricingModel;
    recipients_json?: Array<{ id: string; email: string; name: string; role: "signer" | "approver" | "viewer" }>;
    contact_id?: string | null;
  },
): Promise<DocumentRecord | null> {
  const existing = await getDocument(documentId, workspaceId);
  if (!existing) {
    return null;
  }

  if (existing.status === "SIGNED" || existing.status === "PAID" || existing.status === "VOID") {
    throw new Error("Finalized documents are immutable");
  }

  if (input.contact_id !== undefined && input.contact_id !== null) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: input.contact_id,
        workspace_id: workspaceId,
      },
      select: { id: true },
    });
    if (!contact) {
      throw new Error("Contact not found");
    }
  }

  const row = await prisma.document.update({
    where: { id: documentId },
    data: {
      editor_json: input.editor_json ? normalizeEditorDoc(input.editor_json) : existing.editor_json,
      variables_json: (input.variables_json ?? existing.variables_json) as InputJsonValue,
      pricing_json: (input.pricing_json ?? existing.pricing_json) as InputJsonValue,
      recipients_json: (input.recipients_json ?? existing.recipients_json) as InputJsonValue,
      contact_id: input.contact_id !== undefined ? input.contact_id : existing.contact_id,
    },
  });

  return parseDocument(row);
}

export async function sendDocument(
  documentId: string,
  workspaceId: string,
  actorUserId: string,
): Promise<DocumentRecord | null> {
  const existing = await getDocument(documentId, workspaceId);
  if (!existing) {
    return null;
  }
  if (existing.status === "SIGNED" || existing.status === "PAID" || existing.status === "VOID") {
    throw new Error("Document cannot be sent in its current status");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { cpq_approval_discount_threshold: true },
  });
  const threshold = Number(workspace?.cpq_approval_discount_threshold ?? 100);
  const discountPercent = getDiscountPercent(existing.pricing_json);

  if (requiresQuoteApproval({ discountPercent, thresholdPercent: threshold })) {
    const latestApproval = await prisma.quoteApprovalRequest.findFirst({
      where: {
        workspace_id: workspaceId,
        document_id: documentId,
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    });
    if (!latestApproval || latestApproval.status !== "APPROVED") {
      throw new QuoteApprovalRequiredError(
        `Quote discount ${discountPercent.toFixed(2)}% exceeds workspace threshold ${threshold.toFixed(2)}%. Approval required before send.`,
      );
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: documentId },
      data: { status: "SENT" },
    });

    await tx.documentActivityEvent.create({
      data: {
        workspace_id: workspaceId,
        document_id: documentId,
        event_type: "DOCUMENT_SENT",
        actor_user_id: actorUserId,
        metadata_json: {},
      },
    });

    return updated;
  });

  return parseDocument(row);
}

export async function getLatestQuoteApproval(documentId: string, workspaceId: string): Promise<QuoteApprovalRecord | null> {
  const row = await prisma.quoteApprovalRequest.findFirst({
    where: {
      workspace_id: workspaceId,
      document_id: documentId,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });
  if (!row) {
    return null;
  }
  return parseQuoteApproval(row);
}

export async function requestQuoteApproval(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
  reason?: string;
}): Promise<QuoteApprovalRecord> {
  const existing = await getDocument(input.documentId, input.workspaceId);
  if (!existing) {
    throw new Error("Document not found");
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { cpq_approval_discount_threshold: true },
  });
  const threshold = Number(workspace?.cpq_approval_discount_threshold ?? 100);
  const discountPercent = getDiscountPercent(existing.pricing_json);
  if (!requiresQuoteApproval({ discountPercent, thresholdPercent: threshold })) {
    throw new Error("Approval is not required for current discount");
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.quoteApprovalRequest.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        status: "PENDING",
        requested_by_user_id: input.actorUserId,
        requested_reason: input.reason?.trim() || null,
        discount_percent: discountPercent,
        threshold_percent: threshold,
      },
    });
    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        event_type: "CPQ_APPROVAL_REQUESTED",
        actor_user_id: input.actorUserId,
        metadata_json: {
          approvalId: created.id,
          discountPercent,
          thresholdPercent: threshold,
          reason: input.reason?.trim() || null,
        },
      },
    });
    return created;
  });
  return parseQuoteApproval(row);
}

export async function decideQuoteApproval(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string;
}): Promise<QuoteApprovalRecord> {
  const pending = await prisma.quoteApprovalRequest.findFirst({
    where: {
      workspace_id: input.workspaceId,
      document_id: input.documentId,
      status: "PENDING",
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });
  if (!pending) {
    throw new Error("No pending approval request found");
  }
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.quoteApprovalRequest.update({
      where: { id: pending.id },
      data: {
        status: input.decision,
        decided_by_user_id: input.actorUserId,
        decided_reason: input.reason?.trim() || null,
        decided_at: new Date(),
      },
    });
    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        event_type: input.decision === "APPROVED" ? "CPQ_APPROVAL_APPROVED" : "CPQ_APPROVAL_REJECTED",
        actor_user_id: input.actorUserId,
        metadata_json: {
          approvalId: pending.id,
          reason: input.reason?.trim() || null,
        },
      },
    });
    return updated;
  });
  return parseQuoteApproval(row);
}

export async function markDocumentViewed(input: {
  documentId: string;
  workspaceId: string;
  actorUserId?: string;
  actorRecipientId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<DocumentRecord | null> {
  const existing = await getDocument(input.documentId, input.workspaceId);
  if (!existing) {
    return null;
  }
  if (existing.status === "SIGNED" || existing.status === "PAID" || existing.status === "VOID") {
    return existing;
  }

  const nextStatus = existing.status === "SENT" || existing.status === "DRAFTED" ? "VIEWED" : existing.status;
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: input.documentId },
      data: {
        status: nextStatus as
          | "DRAFTED"
          | "SENT"
          | "VIEWED"
          | "COMMENTED"
          | "SIGNED"
          | "PAID"
          | "EXPIRED"
          | "VOID",
      },
    });

    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        event_type: "DOCUMENT_VIEWED",
        actor_user_id: input.actorUserId,
        actor_recipient_id: input.actorRecipientId,
        metadata_json: {
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      },
    });

    return updated;
  });

  return parseDocument(row);
}

export async function addDocumentComment(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
  message: string;
}): Promise<DocumentRecord | null> {
  const existing = await getDocument(input.documentId, input.workspaceId);
  if (!existing) {
    return null;
  }
  if (existing.status === "SIGNED" || existing.status === "PAID" || existing.status === "VOID") {
    throw new Error("Document is immutable in current state");
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: input.documentId },
      data: { status: "COMMENTED" },
    });

    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        event_type: "DOCUMENT_COMMENTED",
        actor_user_id: input.actorUserId,
        metadata_json: { message: input.message },
      },
    });

    return updated;
  });

  return parseDocument(row);
}

function extractSignerFields(doc: EditorDoc): Array<{
  fieldId: string;
  recipientId: string;
  type: "signature" | "initial" | "date" | "text" | "checkbox";
  required: boolean;
}> {
  const fields: Array<{
    fieldId: string;
    recipientId: string;
    type: "signature" | "initial" | "date" | "text" | "checkbox";
    required: boolean;
  }> = [];

  const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (node.type === "signerField") {
      fields.push({
        fieldId: String(node.attrs?.fieldId ?? ""),
        recipientId: String(node.attrs?.recipientId ?? ""),
        type: (node.attrs?.type as "signature" | "initial" | "date" | "text" | "checkbox") ?? "text",
        required: Boolean(node.attrs?.required ?? true),
      });
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] });
      }
    }
  };

  walk(doc);
  return fields;
}

export async function getDocumentSignerFields(documentId: string, workspaceId: string) {
  const document = await getDocument(documentId, workspaceId);
  if (!document) {
    throw new Error("Document not found");
  }

  const fields = extractSignerFields(document.editor_json);
  return fields;
}

export async function listDocumentActivity(
  documentId: string,
  workspaceId: string,
  options?: { limit?: number; before?: Date },
): Promise<DocumentActivityRecord[]> {
  const rows = await prisma.documentActivityEvent.findMany({
    where: {
      workspace_id: workspaceId,
      document_id: documentId,
      created_at: options?.before ? { lt: options.before } : undefined,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 100,
  });

  return rows.map(parseActivityEvent);
}

export async function setSignerFieldValue(input: {
  documentId: string;
  workspaceId: string;
  actorRecipientId: string;
  fieldId: string;
  value: string | boolean;
}): Promise<SignerFieldValue[]> {
  const document = await getDocument(input.documentId, input.workspaceId);
  if (!document) {
    throw new Error("Document not found");
  }
  if (document.status === "SIGNED" || document.status === "PAID" || document.status === "VOID") {
    throw new Error("Finalized documents are immutable");
  }

  const signerFields = extractSignerFields(document.editor_json);
  const mapping = signerFields.find((field) => field.fieldId === input.fieldId);
  if (!mapping) {
    throw new Error("Signer field not found");
  }

  const recipient = document.recipients_json.find((item) => item.id === input.actorRecipientId);
  if (!recipient || !canRecipientFillField(input.actorRecipientId, mapping.recipientId, recipient.role)) {
    throw new Error("Recipient is not allowed to fill this field");
  }

  const recipientRows = await prisma.recipient.findMany({
    where: { document_id: document.id },
    orderBy: { signing_order: "asc" },
  });
  const actorRecipient = recipientRows.find((row) => row.id === input.actorRecipientId);
  if (!actorRecipient) {
    throw new Error("Recipient is not assigned to this document");
  }

  const existingRows = await prisma.signatureField.findMany({
    where: { document_id: document.id },
  });
  const existing: SignerFieldValue[] = existingRows.map((row) => ({
    fieldId: row.id,
    recipientId: row.recipient_id,
    type: row.field_type.toLowerCase() as SignerFieldValue["type"],
    required: row.required,
    value: row.value_json as unknown as SignerFieldValue["value"],
  }));

  const hasValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return true;
  };
  const existingByFieldId = new Map(existingRows.map((row) => [row.id, row.value_json]));
  const pendingOrders = extractSignerFields(document.editor_json)
    .filter((field) => field.required)
    .filter((field) => !hasValue(existingByFieldId.get(field.fieldId)))
    .map((field) => recipientRows.find((row) => row.id === field.recipientId)?.signing_order)
    .filter((value): value is number => typeof value === "number");
  const lowestPendingOrder = pendingOrders.length > 0 ? Math.min(...pendingOrders) : null;
  if (lowestPendingOrder !== null && actorRecipient.signing_order > lowestPendingOrder) {
    throw new Error("Signer cannot fill fields before earlier signing order recipients");
  }

  const next = applySignerFieldValue(existing, { recipientId: recipient.id, role: recipient.role }, {
    fieldId: mapping.fieldId,
    recipientId: mapping.recipientId,
    type: mapping.type,
    required: mapping.required,
    value: input.value,
  });

  const enumFieldType: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX" =
    mapping.type === "initial" ? "INITIALS" : (mapping.type.toUpperCase() as "SIGNATURE" | "DATE" | "TEXT" | "CHECKBOX");

  await prisma.signatureField.upsert({
    where: { id: mapping.fieldId },
    create: {
      id: mapping.fieldId,
      document_id: document.id,
      recipient_id: mapping.recipientId,
      field_type: enumFieldType,
      required: mapping.required,
      value_json: input.value,
      position_json: {},
    },
    update: {
      value_json: input.value,
      signed_at: mapping.type === "signature" ? new Date() : undefined,
    },
  });

  await prisma.documentActivityEvent.create({
    data: {
      workspace_id: input.workspaceId,
      document_id: document.id,
      event_type: "SIGNER_FIELD_UPDATED",
      actor_recipient_id: input.actorRecipientId,
      metadata_json: {
        fieldId: mapping.fieldId,
        fieldType: mapping.type,
      },
    },
  });

  return next;
}

export async function renderDocumentHtml(input: {
  documentId: string;
  workspaceId: string;
  mode: "sender-preview" | "recipient-fill" | "finalized";
  recipientId?: string;
}): Promise<{ html: string; missing: string[] }> {
  const document = await getDocument(input.documentId, input.workspaceId);
  if (!document) {
    throw new Error("Document not found");
  }

  const template = document.template_id
    ? await prisma.template.findUnique({ where: { id: document.template_id } })
    : null;
  const variableRegistry = (template?.variable_registry_json as Record<string, { required: boolean }>) ?? {};
  const variableOutput = resolveTemplateVariables(variableRegistry, document.variables_json);

  const rows = await prisma.signatureField.findMany({
    where: { document_id: document.id },
    orderBy: { created_at: "asc" },
  });
  const signerFieldValues: SignerFieldValue[] = rows.map((row) => ({
    fieldId: row.id,
    recipientId: row.recipient_id,
    type: row.field_type.toLowerCase() as SignerFieldValue["type"],
    required: row.required,
    value: row.value_json as unknown as SignerFieldValue["value"],
  }));

  const finalizedEvent =
    input.mode === "finalized"
      ? await prisma.documentActivityEvent.findFirst({
          where: {
            workspace_id: input.workspaceId,
            document_id: document.id,
            event_type: "DOCUMENT_FINALIZED",
          },
          orderBy: { created_at: "desc" },
        })
      : null;
  const finalizedMetadata = (finalizedEvent?.metadata_json as Record<string, unknown> | undefined) ?? undefined;
  const certificate =
    input.mode === "finalized" && document.doc_hash
      ? {
          docHash: document.doc_hash,
          finalizedAt:
            typeof finalizedMetadata?.finalizedAt === "string"
              ? finalizedMetadata.finalizedAt
              : document.updated_at,
          actorUserId:
            typeof finalizedMetadata?.actorUserId === "string"
              ? finalizedMetadata.actorUserId
              : undefined,
          actorRecipientId:
            typeof finalizedMetadata?.actorRecipientId === "string"
              ? finalizedMetadata.actorRecipientId
              : undefined,
          ipAddress:
            typeof finalizedMetadata?.ipAddress === "string" ? finalizedMetadata.ipAddress : undefined,
          userAgent:
            typeof finalizedMetadata?.userAgent === "string" ? finalizedMetadata.userAgent : undefined,
          pdfKey: document.finalized_pdf_key ?? undefined,
        }
      : undefined;

  const html = renderComputedHtml({
    doc: document.editor_json,
    mode: input.mode,
    resolvedVariables: variableOutput.resolved,
    pricing: document.pricing_json,
    signerFieldValues,
    activeRecipientId: input.recipientId,
    certificate,
  });

  return { html, missing: variableOutput.missing };
}

export async function finalizeDocument(input: {
  documentId: string;
  workspaceId: string;
  actorUserId?: string;
  actorRecipientId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{
  doc_hash: string;
  html: string;
  pdf_key: string;
  certificate: {
    finalizedAt: string;
    actorUserId?: string;
    actorRecipientId?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}> {
  const document = await getDocument(input.documentId, input.workspaceId);
  if (!document) {
    throw new Error("Document not found");
  }

  if (
    (document.status === "SIGNED" || document.status === "PAID") &&
    document.doc_hash &&
    document.finalized_pdf_key
  ) {
    const finalizedEvent = await prisma.documentActivityEvent.findFirst({
      where: {
        workspace_id: input.workspaceId,
        document_id: document.id,
        event_type: "DOCUMENT_FINALIZED",
      },
      orderBy: { created_at: "desc" },
    });
    const finalizedMetadata = (finalizedEvent?.metadata_json as Record<string, unknown> | undefined) ?? undefined;
    const certificate = {
      finalizedAt:
        typeof finalizedMetadata?.finalizedAt === "string" ? finalizedMetadata.finalizedAt : document.updated_at,
      actorUserId:
        typeof finalizedMetadata?.actorUserId === "string" ? finalizedMetadata.actorUserId : undefined,
      actorRecipientId:
        typeof finalizedMetadata?.actorRecipientId === "string" ? finalizedMetadata.actorRecipientId : undefined,
      ipAddress: typeof finalizedMetadata?.ipAddress === "string" ? finalizedMetadata.ipAddress : undefined,
      userAgent: typeof finalizedMetadata?.userAgent === "string" ? finalizedMetadata.userAgent : undefined,
    };
    return {
      doc_hash: document.doc_hash,
      pdf_key: document.finalized_pdf_key,
      certificate,
      html: await renderDocumentHtml({
        documentId: input.documentId,
        workspaceId: input.workspaceId,
        mode: "finalized",
      }).then((result) => result.html),
    };
  }

  const rows = await prisma.signatureField.findMany({
    where: { document_id: document.id },
    orderBy: { created_at: "asc" },
  });
  const signerFieldValues: SignerFieldValue[] = rows.map((row) => ({
    fieldId: row.id,
    recipientId: row.recipient_id,
    type: row.field_type.toLowerCase() as SignerFieldValue["type"],
    required: row.required,
    value: row.value_json as unknown as SignerFieldValue["value"],
  }));

  const template = document.template_id
    ? await prisma.template.findUnique({ where: { id: document.template_id } })
    : null;
  const variableRegistry = (template?.variable_registry_json as Record<string, { required: boolean }>) ?? {};
  const variableOutput = resolveTemplateVariables(variableRegistry, document.variables_json);

  const doc_hash = computeDocumentHash({
    editor_json: document.editor_json,
    resolved_variables: variableOutput.resolved,
    pricing_json: document.pricing_json,
    signer_field_values: signerFieldValues,
  });

  const finalizedAt = new Date().toISOString();
  const pdf_key = `documents/${input.workspaceId}/${document.id}/${doc_hash}.pdf`;
  const certificate = {
    finalizedAt,
    actorUserId: input.actorUserId,
    actorRecipientId: input.actorRecipientId,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };

  await prisma.document.update({
    where: { id: document.id },
    data: {
      doc_hash,
      finalized_pdf_key: pdf_key,
      status: document.status === "PAID" ? "PAID" : "SIGNED",
    },
  });

  await prisma.documentActivityEvent.create({
    data: {
      workspace_id: input.workspaceId,
      document_id: document.id,
      event_type: "DOCUMENT_FINALIZED",
      actor_user_id: input.actorUserId,
      actor_recipient_id: input.actorRecipientId,
      metadata_json: {
        hash: doc_hash,
        finalizedAt: certificate.finalizedAt,
        actorUserId: certificate.actorUserId ?? null,
        actorRecipientId: certificate.actorRecipientId ?? null,
        ipAddress: certificate.ipAddress,
        userAgent: certificate.userAgent,
        pdfKey: pdf_key,
      },
    },
  });

  const html = renderComputedHtml({
    doc: document.editor_json,
    mode: "finalized",
    resolvedVariables: variableOutput.resolved,
    pricing: document.pricing_json,
    signerFieldValues,
    certificate: {
      docHash: doc_hash,
      finalizedAt: certificate.finalizedAt,
      actorUserId: certificate.actorUserId,
      actorRecipientId: certificate.actorRecipientId,
      ipAddress: certificate.ipAddress,
      userAgent: certificate.userAgent,
      pdfKey: pdf_key,
    },
  });

  return { doc_hash, html, pdf_key, certificate };
}

export async function markDocumentPaid(input: {
  documentId: string;
  workspaceId: string;
  actorUserId?: string;
  paymentId: string;
  provider: "stripe";
  providerSessionId: string;
  amountMinor: number;
  currency: string;
}) {
  const document = await getDocument(input.documentId, input.workspaceId);
  if (!document) {
    throw new Error("Document not found");
  }
  if (document.status !== "SIGNED" && document.status !== "PAID") {
    throw new Error("Document must be signed before payment can be recorded");
  }

  await prisma.$transaction(async (tx) => {
    if (document.status !== "PAID") {
      await tx.document.update({
        where: { id: input.documentId },
        data: { status: "PAID" },
      });
    }
    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        event_type: "DOCUMENT_PAID",
        actor_user_id: input.actorUserId,
        metadata_json: {
          paymentId: input.paymentId,
          provider: input.provider,
          providerSessionId: input.providerSessionId,
          amountMinor: input.amountMinor,
          currency: input.currency.toUpperCase(),
        },
      },
    });
  });
}
