import { prisma, type InputJsonValue } from "@repo/db";
import { contactRecordToVariableContext } from "@/lib/crm/variables";
import type { VariableContext } from "@/lib/editor/types";
import { isDraftEditableStatus } from "@/lib/editor/sent-snapshot";

type Bag = Record<string, unknown>;

/** Namespaces filled from the sender's account or the linked contact. */
const SENDER_NAMESPACES = ["Sender"] as const;
const RECIPIENT_NAMESPACES = ["Recipient", "Client", "Company"] as const;

function countryName(code: string | null | undefined): string {
  if (!code) {
    return "";
  }
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export async function loadSenderVariables(workspaceId: string, userId: string): Promise<Bag> {
  const [user, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, city: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, legal_name: true, business_phone: true, business_email: true, country: true },
    }),
  ]);
  return {
    Sender: {
      FullName: user?.name?.trim() ?? "",
      CompanyName: workspace?.legal_name?.trim() || workspace?.name?.trim() || "",
      FullAddress: [user?.city?.trim(), countryName(workspace?.country)].filter(Boolean).join(", "),
      Phone: user?.phone?.trim() || workspace?.business_phone?.trim() || "",
      Email: user?.email?.trim() || workspace?.business_email?.trim() || "",
    },
  };
}

async function loadRecipientVariables(workspaceId: string, contactId: string): Promise<Bag | null> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspace_id: workspaceId },
    include: { company: true },
  });
  return contact ? contactRecordToVariableContext(contact) : null;
}

function asBag(value: unknown): Bag {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Bag) : {};
}

/**
 * Fill empty values in the given namespaces without overwriting anything the
 * user typed. Returns the same object when nothing changed.
 */
export function fillEmptyVariables(
  existing: Bag,
  incoming: Bag,
  namespaces: readonly string[],
): Bag {
  let next: Bag | null = null;
  for (const ns of namespaces) {
    const source = asBag(incoming[ns]);
    const current = asBag((next ?? existing)[ns]);
    let merged: Bag | null = null;
    for (const [key, value] of Object.entries(source)) {
      const text = typeof value === "string" ? value.trim() : "";
      const have = current[key];
      if (!text || (typeof have === "string" ? have.trim() : have != null && have !== "")) {
        continue;
      }
      merged = { ...(merged ?? current), [key]: text };
    }
    if (merged) {
      next = { ...(next ?? existing), [ns]: merged };
    }
  }
  return next ?? existing;
}

/**
 * Ensure a draft's Sender variables reflect the signed-in user's account and its
 * Recipient variables reflect the linked contact. Persists only when something
 * was missing; sent/finalized documents are left untouched.
 */
export async function hydrateDraftIdentityVariables(input: {
  documentId: string;
  workspaceId: string;
  userId: string;
}): Promise<boolean> {
  const row = await prisma.document.findFirst({
    where: { id: input.documentId, workspace_id: input.workspaceId },
    select: { status: true, contact_id: true, variables_json: true, sentVersions: { select: { id: true }, take: 1 } },
  });
  if (!row || !isDraftEditableStatus(row.status) || row.sentVersions.length > 0) {
    return false;
  }
  const existing = asBag(row.variables_json);
  let next = fillEmptyVariables(
    existing,
    await loadSenderVariables(input.workspaceId, input.userId),
    SENDER_NAMESPACES,
  );
  if (row.contact_id) {
    const recipient = await loadRecipientVariables(input.workspaceId, row.contact_id);
    if (recipient) {
      next = fillEmptyVariables(next, recipient, RECIPIENT_NAMESPACES);
    }
  }
  if (next === existing) {
    return false;
  }
  await prisma.document.update({
    where: { id: input.documentId },
    data: { variables_json: next as VariableContext as InputJsonValue },
  });
  return true;
}
