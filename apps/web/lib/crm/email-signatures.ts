import { prisma } from "@repo/db";

export type CrmEmailSignatureDto = {
  id: string;
  accountId: string | null;
  name: string;
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeEmailSignature(row: {
  id: string;
  account_id: string | null;
  name: string;
  body_html: string;
  created_at: Date;
  updated_at: Date;
}): CrmEmailSignatureDto {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    bodyHtml: row.body_html,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listEmailSignatures(
  workspaceId: string,
  options?: { accountId?: string | null; userId?: string | null },
) {
  if (!prisma.crmEmailSignature) {
    return [];
  }
  const rows = await prisma.crmEmailSignature.findMany({
    where: {
      workspace_id: workspaceId,
      ...(options?.accountId
        ? { OR: [{ account_id: options.accountId }, { account_id: null }] }
        : {}),
    },
    orderBy: [{ updated_at: "desc" }, { name: "asc" }],
  });
  return rows.map(serializeEmailSignature);
}

export async function createEmailSignature(
  workspaceId: string,
  input: {
    userId?: string | null;
    accountId?: string | null;
    name: string;
    bodyHtml: string;
  },
) {
  if (!prisma.crmEmailSignature) {
    throw new Error("Email signature storage is restarting. Refresh and try again.");
  }
  const name = input.name.trim().slice(0, 40);
  if (!name) {
    throw new Error("Signature name is required.");
  }
  if (input.accountId) {
    const account = await prisma.crmEmailAccount.findFirst({
      where: { id: input.accountId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!account) {
      throw new Error("Email account not found.");
    }
  }
  const row = await prisma.crmEmailSignature.create({
    data: {
      workspace_id: workspaceId,
      user_id: input.userId ?? null,
      account_id: input.accountId ?? null,
      name,
      body_html: input.bodyHtml || "<p></p>",
    },
  });
  return serializeEmailSignature(row);
}

export async function updateEmailSignature(
  workspaceId: string,
  signatureId: string,
  input: { name?: string; bodyHtml?: string },
) {
  if (!prisma.crmEmailSignature) {
    throw new Error("Email signature storage is restarting. Refresh and try again.");
  }
  const existing = await prisma.crmEmailSignature.findFirst({
    where: { id: signatureId, workspace_id: workspaceId },
  });
  if (!existing) {
    throw new Error("Signature not found.");
  }
  const row = await prisma.crmEmailSignature.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 40) || existing.name } : {}),
      ...(input.bodyHtml !== undefined ? { body_html: input.bodyHtml } : {}),
    },
  });
  return serializeEmailSignature(row);
}

export async function deleteEmailSignature(workspaceId: string, signatureId: string) {
  if (!prisma.crmEmailSignature) {
    throw new Error("Email signature storage is restarting. Refresh and try again.");
  }
  const existing = await prisma.crmEmailSignature.findFirst({
    where: { id: signatureId, workspace_id: workspaceId },
  });
  if (!existing) {
    throw new Error("Signature not found.");
  }
  await prisma.crmEmailSignature.delete({ where: { id: existing.id } });
  return { id: existing.id };
}
