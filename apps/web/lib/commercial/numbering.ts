import { prisma, type Prisma } from "@repo/db";
import type { CommercialDocType } from "./schema";

type Tx = Prisma.TransactionClient;

export async function allocateDocumentNumber(
  workspaceId: string,
  kind: CommercialDocType,
  tx: Tx = prisma,
): Promise<string> {
  const existing = await tx.documentNumberSequence.findUnique({
    where: { workspace_id_kind: { workspace_id: workspaceId, kind } },
  });
  if (!existing) {
    await tx.documentNumberSequence.create({
      data: { workspace_id: workspaceId, kind, next_number: 2 },
    });
    return "1";
  }
  const number = existing.next_number;
  await tx.documentNumberSequence.update({
    where: { id: existing.id },
    data: { next_number: number + 1 },
  });
  return String(number);
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
      throw new Error("Document number already in use");
    }
    throw error;
  }
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
