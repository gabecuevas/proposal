import { randomUUID } from "node:crypto";
import { prisma, type InputJsonValue } from "@repo/db";
import { defaultEditorDoc } from "@/lib/editor/defaults";
import {
  CURRENT_DOC_VERSION,
  type EditorDoc,
  type VariableContext,
} from "@/lib/editor/types";
import {
  documentKindFromVariables,
  withDocumentKindVariables,
  type WorkflowDocumentKind,
} from "@/lib/editor/document-kind";
import { isSupportedCurrency, normalizeCurrency } from "./currencies";
import { createBlankCommercialDocument, type CommercialDocType, type CommercialDocument, isCommercialDocument } from "./schema";
import {
  convertQuoteToInvoicePayload,
  ensureCommercialDocument,
  instantiateCommercialFromTemplate,
  parseCommercialDocument,
  toCommercialTemplatePayload,
} from "./parse";
import { claimDocumentNumber, allocateDocumentNumber, sumCompletedPaymentsMinor } from "./numbering";
import { calculateCommercialTotals, validateCommercialDocument } from "./calculate";
import { resolveCommercialText } from "./variables";

export type CommercialDocumentRecord = {
  id: string;
  workspace_id: string;
  template_id: string | null;
  contact_id: string | null;
  status: string;
  doc_version: number;
  updated_at: string;
  created_at: string;
  commercial: CommercialDocument;
  paidFromLedgerMinor: number;
  totals: ReturnType<typeof calculateCommercialTotals>;
  variables_json: VariableContext;
  recipients_json: unknown;
  sent: boolean;
};

function isDraftEditable(status: string): boolean {
  return status === "DRAFTED" || status === "EXPIRED";
}

export function commercialTypeFromKind(kind: WorkflowDocumentKind): CommercialDocType | null {
  if (kind === "quote" || kind === "invoice") {
    return kind;
  }
  return null;
}

export function isCommercialKind(kind: WorkflowDocumentKind): boolean {
  return kind === "quote" || kind === "invoice";
}

function parseRecord(
  row: {
    id: string;
    workspace_id: string;
    template_id: string | null;
    contact_id: string | null;
    status: string;
    doc_version: number;
    updated_at: Date;
    created_at: Date;
    pricing_json: unknown;
    variables_json: unknown;
    recipients_json: unknown;
    sentVersions?: Array<{ id: string }> | null;
  },
  paidFromLedgerMinor: number,
): CommercialDocumentRecord {
  const kind = documentKindFromVariables(row.variables_json);
  const type = commercialTypeFromKind(kind) ?? "quote";
  const commercial = ensureCommercialDocument(row.pricing_json, type);
  const totals = calculateCommercialTotals({
    document: commercial,
    amountPaidMinorOverride: type === "invoice" ? paidFromLedgerMinor || commercial.amountPaidMinor : 0,
  });
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    template_id: row.template_id,
    contact_id: row.contact_id,
    status: row.status,
    doc_version: row.doc_version,
    updated_at: row.updated_at.toISOString(),
    created_at: row.created_at.toISOString(),
    commercial,
    paidFromLedgerMinor,
    totals,
    variables_json: (row.variables_json as VariableContext) ?? {},
    recipients_json: row.recipients_json,
    sent: Boolean(row.sentVersions && row.sentVersions.length > 0) || !isDraftEditable(row.status),
  };
}

export async function getCommercialDocument(
  documentId: string,
  workspaceId: string,
): Promise<CommercialDocumentRecord | null> {
  const row = await prisma.document.findFirst({
    where: { id: documentId, workspace_id: workspaceId },
    include: { sentVersions: { select: { id: true }, take: 1 } },
  });
  if (!row) {
    return null;
  }
  if (!isCommercialDocument(row.pricing_json) && !isCommercialKind(documentKindFromVariables(row.variables_json))) {
    return null;
  }
  const paid = await sumCompletedPaymentsMinor(documentId, workspaceId);
  const record = parseRecord(row, paid);
  if (!record.commercial.logoAssetKey) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { logo_asset_key: true },
    });
    if (workspace?.logo_asset_key) {
      record.commercial = { ...record.commercial, logoAssetKey: workspace.logo_asset_key };
    }
  }
  return record;
}

export async function createCommercialDraft(input: {
  workspaceId: string;
  actorUserId: string;
  type: CommercialDocType;
  templateId?: string | null;
  idempotencyKey?: string | null;
}): Promise<CommercialDocumentRecord> {
  // Idempotency: reuse a draft created with the same client key in the last 2 minutes.
  if (input.idempotencyKey) {
    const recent = await prisma.documentActivityEvent.findFirst({
      where: {
        workspace_id: input.workspaceId,
        event_type: "DOCUMENT_CREATED",
        actor_user_id: input.actorUserId,
        created_at: { gte: new Date(Date.now() - 2 * 60 * 1000) },
        metadata_json: {
          path: ["idempotencyKey"],
          equals: input.idempotencyKey,
        },
      },
      orderBy: { created_at: "desc" },
    });
    if (recent) {
      const existing = await getCommercialDocument(recent.document_id, input.workspaceId);
      if (existing) {
        return existing;
      }
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const number = await allocateDocumentNumber(input.workspaceId, input.type, tx);
    const templateId: string | null = input.templateId ?? null;

    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { logo_asset_key: true, currency: true },
    });
    let commercial = createBlankCommercialDocument(input.type, {
      documentNumber: number,
      currency: normalizeCurrency(workspace?.currency),
    });
    if (workspace?.logo_asset_key) {
      commercial = { ...commercial, logoAssetKey: workspace.logo_asset_key };
    }

    if (templateId) {
      const template = await tx.template.findFirst({
        where: { id: templateId, workspace_id: input.workspaceId },
      });
      if (!template) {
        throw new Error("Template not found");
      }
      const parsed = parseCommercialDocument(template.pricing_json, input.type);
      if (parsed) {
        commercial = instantiateCommercialFromTemplate(parsed, {
          type: input.type,
          documentNumber: number,
          issueDate: new Date().toISOString().slice(0, 10),
          sourceTemplateId: template.id,
          internalName: template.name,
        });
      }
    }

    const created = await tx.document.create({
      data: {
        workspace_id: input.workspaceId,
        template_id: templateId,
        editor_json: defaultEditorDoc as InputJsonValue,
        schema_version: CURRENT_DOC_VERSION,
        doc_version: 1,
        status: "DRAFTED",
        variables_json: withDocumentKindVariables(
          { title: commercial.internalName, editor_layout: "commercial" },
          input.type,
          "commercial",
        ) as InputJsonValue,
        pricing_json: commercial as unknown as InputJsonValue,
        recipients_json: [
          {
            id: randomUUID(),
            email: "",
            name: "Primary Recipient",
            role: "signer",
          },
        ] as InputJsonValue,
      },
    });

    await claimDocumentNumber({
      workspaceId: input.workspaceId,
      kind: input.type,
      documentId: created.id,
      documentNumber: number,
      tx,
    });

    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: created.id,
        event_type: "DOCUMENT_CREATED",
        actor_user_id: input.actorUserId,
        metadata_json: {
          source: templateId ? "commercial_template" : "commercial_blank",
          document_kind: input.type,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      },
    });

    return created;
  });

  const paid = await sumCompletedPaymentsMinor(row.id, input.workspaceId);
  return parseRecord(
    { ...row, sentVersions: [] },
    paid,
  );
}

export class CommercialConflictError extends Error {
  constructor(message = "Document was updated elsewhere. Reload and try again.") {
    super(message);
    this.name = "CommercialConflictError";
  }
}

export class CommercialImmutableError extends Error {
  constructor(message = "Sent documents cannot be edited. Duplicate or create a revision.") {
    super(message);
    this.name = "CommercialImmutableError";
  }
}

export async function updateCommercialDocument(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
  expectedVersion: number;
  commercial: CommercialDocument;
  variables?: VariableContext;
}): Promise<CommercialDocumentRecord> {
  const existing = await prisma.document.findFirst({
    where: { id: input.documentId, workspace_id: input.workspaceId },
    include: { sentVersions: { select: { id: true }, take: 1 } },
  });
  if (!existing) {
    throw new Error("Document not found");
  }
  if (!isDraftEditable(existing.status) || (existing.sentVersions?.length ?? 0) > 0) {
    throw new CommercialImmutableError();
  }
  if (existing.doc_version !== input.expectedVersion) {
    throw new CommercialConflictError();
  }

  const kind = documentKindFromVariables(existing.variables_json);
  const type = commercialTypeFromKind(kind) ?? input.commercial.type;
  const commercial = { ...input.commercial, type, schema: "commercial_v1" as const };
  const issues = validateCommercialDocument(commercial);
  const blocking = issues.filter((issue) =>
    ["discount_percent_range", "tax_percent_range", "discount_exceeds_subtotal", "negative_quantity", "negative_rate", "negative_shipping", "negative_tax", "nonfinite", "rate_too_large"].includes(
      issue.code,
    ),
  );
  if (blocking.length > 0) {
    throw new Error(blocking[0]!.message);
  }

  commercial.currency = commercial.currency.toUpperCase();
  const previousCurrency = parseCommercialDocument(existing.pricing_json, type)?.currency;
  if (previousCurrency !== commercial.currency) {
    if (!isSupportedCurrency(commercial.currency)) {
      throw new Error("Choose a supported currency.");
    }
    if (previousCurrency && (await sumCompletedPaymentsMinor(input.documentId, input.workspaceId)) > 0) {
      throw new Error("Currency can't be changed after payments have been recorded.");
    }
  }

  const variables = withDocumentKindVariables(
    {
      ...(existing.variables_json as VariableContext),
      ...(input.variables ?? {}),
      title: commercial.internalName,
      editor_layout: "commercial",
    },
    type,
    "commercial",
  );

  await prisma.$transaction(async (tx) => {
    if (!commercial.documentNumber.trim()) {
      const current = await tx.documentIssuedNumber.findUnique({
        where: { document_id: input.documentId },
        select: { document_number: true, kind: true },
      });
      commercial.documentNumber =
        current && current.kind === type
          ? current.document_number
          : await allocateDocumentNumber(input.workspaceId, type, tx);
    }
    await claimDocumentNumber({
      workspaceId: input.workspaceId,
      kind: type,
      documentId: input.documentId,
      documentNumber: commercial.documentNumber,
      tx,
    });
    const updated = await tx.document.updateMany({
      where: {
        id: input.documentId,
        workspace_id: input.workspaceId,
        doc_version: input.expectedVersion,
      },
      data: {
        pricing_json: commercial as unknown as InputJsonValue,
        variables_json: variables as InputJsonValue,
        contact_id: commercial.contactId ?? existing.contact_id,
        doc_version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new CommercialConflictError();
    }
    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: input.documentId,
        event_type: "DOCUMENT_UPDATED",
        actor_user_id: input.actorUserId,
        metadata_json: { source: "commercial_builder" },
      },
    });
  });

  const next = await getCommercialDocument(input.documentId, input.workspaceId);
  if (!next) {
    throw new Error("Document not found");
  }
  return next;
}

export async function saveCommercialAsTemplate(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
  name: string;
  description?: string;
  folderId?: string | null;
}): Promise<{ templateId: string }> {
  const doc = await getCommercialDocument(input.documentId, input.workspaceId);
  if (!doc) {
    throw new Error("Document not found");
  }
  const payload = toCommercialTemplatePayload(doc.commercial);
  const tags = ["commercial", doc.commercial.type, ...(input.description ? ["desc"] : [])];
  const template = await prisma.template.create({
    data: {
      workspace_id: input.workspaceId,
      folder_id: input.folderId ?? null,
      name: input.name.trim(),
      tags: tags as InputJsonValue,
      variable_registry_json: {} as InputJsonValue,
      pricing_json: payload as unknown as InputJsonValue,
      editor_json: defaultEditorDoc as InputJsonValue,
      schema_version: CURRENT_DOC_VERSION,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    },
  });
  return { templateId: template.id };
}

export async function convertQuoteToInvoice(input: {
  quoteDocumentId: string;
  workspaceId: string;
  actorUserId: string;
  dueDate?: string | null;
}): Promise<CommercialDocumentRecord> {
  const quote = await getCommercialDocument(input.quoteDocumentId, input.workspaceId);
  if (!quote) {
    throw new Error("Document not found");
  }
  if (quote.commercial.type !== "quote") {
    throw new Error("Only quotes can be converted to invoices");
  }

  const existingLink = await prisma.document.findFirst({
    where: {
      workspace_id: input.workspaceId,
      pricing_json: {
        path: ["sourceQuoteDocumentId"],
        equals: input.quoteDocumentId,
      },
    },
    orderBy: { created_at: "asc" },
  });
  if (existingLink) {
    const linked = await getCommercialDocument(existingLink.id, input.workspaceId);
    if (linked) {
      return linked;
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const number = await allocateDocumentNumber(input.workspaceId, "invoice", tx);
    const commercial = convertQuoteToInvoicePayload(quote.commercial, {
      documentNumber: number,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: input.dueDate ?? null,
      sourceQuoteDocumentId: input.quoteDocumentId,
    });
    const created = await tx.document.create({
      data: {
        workspace_id: input.workspaceId,
        template_id: quote.template_id,
        contact_id: quote.contact_id,
        editor_json: defaultEditorDoc as InputJsonValue,
        schema_version: CURRENT_DOC_VERSION,
        doc_version: 1,
        status: "DRAFTED",
        variables_json: withDocumentKindVariables(
          { title: commercial.internalName, editor_layout: "commercial" },
          "invoice",
          "commercial",
        ) as InputJsonValue,
        pricing_json: commercial as unknown as InputJsonValue,
        recipients_json: quote.recipients_json as InputJsonValue,
      },
    });
    await claimDocumentNumber({
      workspaceId: input.workspaceId,
      kind: "invoice",
      documentId: created.id,
      documentNumber: number,
      tx,
    });
    await tx.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: created.id,
        event_type: "DOCUMENT_CREATED",
        actor_user_id: input.actorUserId,
        metadata_json: {
          source: "convert_quote",
          sourceQuoteDocumentId: input.quoteDocumentId,
        },
      },
    });
    return created;
  });

  return (await getCommercialDocument(row.id, input.workspaceId))!;
}

export async function recordManualPayment(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
  amountMinor: number;
  currency: string;
  paidAt?: string | null;
  reference?: string | null;
  idempotencyKey: string;
}): Promise<{ paymentId: string; amountPaidMinor: number }> {
  if (input.amountMinor <= 0) {
    throw new Error("Payment amount must be positive");
  }
  const doc = await getCommercialDocument(input.documentId, input.workspaceId);
  if (!doc || doc.commercial.type !== "invoice") {
    throw new Error("Manual payments are only supported on invoices");
  }
  if (input.currency.toUpperCase() !== doc.commercial.currency.toUpperCase()) {
    throw new Error(`Payments on this invoice must be in ${doc.commercial.currency}`);
  }

  const existing = await prisma.documentPayment.findUnique({
    where: { provider_session_id: `manual:${input.idempotencyKey}` },
  });
  if (existing) {
    const paid = await sumCompletedPaymentsMinor(input.documentId, input.workspaceId);
    return { paymentId: existing.id, amountPaidMinor: paid };
  }

  const payment = await prisma.documentPayment.create({
    data: {
      workspace_id: input.workspaceId,
      document_id: input.documentId,
      provider: "MANUAL",
      provider_session_id: `manual:${input.idempotencyKey}`,
      status: "COMPLETED",
      amount_minor: Math.trunc(input.amountMinor),
      currency: input.currency.toUpperCase(),
      paid_at: input.paidAt ? new Date(input.paidAt) : new Date(),
      metadata_json: {
        kind: "manual",
        reference: input.reference ?? null,
        actorUserId: input.actorUserId,
        note: "Manual payment record — does not charge a customer.",
      } as InputJsonValue,
    },
  });

  const paid = await sumCompletedPaymentsMinor(input.documentId, input.workspaceId);
  return { paymentId: payment.id, amountPaidMinor: paid };
}

export function collectUnresolvedForSend(
  commercial: CommercialDocument,
  context: Record<string, unknown>,
): string[] {
  const fields = [commercial.sender.text, commercial.billTo.text, commercial.shipTo.text, commercial.notes, commercial.terms];
  const unresolved = new Set<string>();
  for (const field of fields) {
    for (const token of resolveCommercialText(field, context).unresolved) {
      unresolved.add(token);
    }
  }
  return [...unresolved];
}

export type { EditorDoc };
