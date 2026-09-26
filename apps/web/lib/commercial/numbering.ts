import { prisma, type Prisma } from "@repo/db";
import { formatDocumentNumber, parseDocumentNumber, sameNumberSeries } from "./number-format";
import type { CommercialDocType } from "./schema";

type Tx = Prisma.TransactionClient;

const MAX_ALLOCATION_ATTEMPTS = 500;

export class DocumentNumberInUseError extends Error {
  constructor(kind: CommercialDocType, number: string) {
    super(`${kind === "invoice" ? "Invoice" : "Quote"} number ${number} is already used. Choose a different number.`);
    this.name = "DocumentNumberInUseError";
  }
}

/**
 * Hands out the next number in the workspace series (atomic increment), skipping
 * any number a user already typed onto another document.
 */
export async function allocateDocumentNumber(
  workspaceId: string,
  kind: CommercialDocType,
  tx: Tx = prisma,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const sequence = await tx.documentNumberSequence.upsert({
      where: { workspace_id_kind: { workspace_id: workspaceId, kind } },
      create: { workspace_id: workspaceId, kind, next_number: 2 },
      update: { next_number: { increment: 1 } },
    });
    const candidate = formatDocumentNumber(sequence.next_number - 1, {
      prefix: sequence.prefix,
      suffix: sequence.suffix,
      padWidth: sequence.pad_width,
    });
    const taken = await tx.documentIssuedNumber.findUnique({
      where: {
        workspace_id_kind_document_number: {
          workspace_id: workspaceId,
          kind,
          document_number: candidate,
        },
      },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  throw new Error("Could not allocate a document number");
}

/**
 * After a user sets a number by hand, move the series past it so the next
 * document continues from there: 20 → next is 21, SD-0034 → next is SD-0035.
 */
async function advanceSequencePast(
  workspaceId: string,
  kind: CommercialDocType,
  documentNumber: string,
  tx: Tx,
): Promise<void> {
  const parsed = parseDocumentNumber(documentNumber);
  if (!parsed) {
    return;
  }
  const format = { prefix: parsed.prefix, suffix: parsed.suffix, pad_width: parsed.padWidth };
  const sequence = await tx.documentNumberSequence.findUnique({
    where: { workspace_id_kind: { workspace_id: workspaceId, kind } },
  });
  if (!sequence) {
    await tx.documentNumberSequence.create({
      data: { workspace_id: workspaceId, kind, next_number: parsed.value + 1, ...format },
    });
    return;
  }
  const stored = { prefix: sequence.prefix, suffix: sequence.suffix, padWidth: sequence.pad_width };
  if (!sameNumberSeries(stored, parsed)) {
    await tx.documentNumberSequence.update({
      where: { id: sequence.id },
      data: { next_number: parsed.value + 1, ...format },
    });
    return;
  }
  if (parsed.value + 1 > sequence.next_number) {
    await tx.documentNumberSequence.update({
      where: { id: sequence.id },
      data: { next_number: parsed.value + 1, pad_width: Math.max(sequence.pad_width, parsed.padWidth) },
    });
  }
}

export async function claimDocumentNumber(input: {
  workspaceId: string;
  kind: CommercialDocType;
  documentId: string;
  documentNumber: string;
  tx?: Tx;
}): Promise<void> {
  const tx = input.tx ?? prisma;
  const number = input.documentNumber.trim();
  if (!number) {
    throw new Error("Document number is required");
  }
  const existing = await tx.documentIssuedNumber.findUnique({
    where: { document_id: input.documentId },
  });
  if (existing) {
    if (existing.document_number === number && existing.kind === input.kind) {
      return;
    }
    await tx.documentIssuedNumber.delete({ where: { id: existing.id } });
  }
  try {
    await tx.documentIssuedNumber.create({
      data: {
        workspace_id: input.workspaceId,
        kind: input.kind,
        document_number: number,
        document_id: input.documentId,
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      throw new DocumentNumberInUseError(input.kind, number);
    }
    throw error;
  }
  await advanceSequencePast(input.workspaceId, input.kind, number, tx);
}

export async function sumCompletedPaymentsMinor(
  documentId: string,
  workspaceId: string,
): Promise<number> {
  const rows = await prisma.documentPayment.findMany({
    where: {
      document_id: documentId,
      workspace_id: workspaceId,
      status: "COMPLETED",
    },
    select: { amount_minor: true },
  });
  return rows.reduce((sum, row) => sum + row.amount_minor, 0);
}
