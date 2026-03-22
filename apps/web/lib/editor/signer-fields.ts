import type { JSONValue, SignerFieldValue } from "./types";

export type RecipientSummary = {
  recipientId: string;
  role: "signer" | "approver" | "viewer";
};

export function canRecipientFillField(
  actorRecipientId: string,
  fieldRecipientId: string,
  role: RecipientSummary["role"],
): boolean {
  return role === "signer" && actorRecipientId === fieldRecipientId;
}

export function applySignerFieldValue(
  existing: SignerFieldValue[],
  actor: RecipientSummary,
  update: {
    fieldId: string;
    recipientId: string;
    type: SignerFieldValue["type"];
    required: boolean;
    value: JSONValue;
  },
): SignerFieldValue[] {
  if (!canRecipientFillField(actor.recipientId, update.recipientId, actor.role)) {
    throw new Error("Recipient is not allowed to fill this field");
  }

  const next = existing.filter((field) => field.fieldId !== update.fieldId);
  next.push({
    fieldId: update.fieldId,
    recipientId: update.recipientId,
    type: update.type,
    required: update.required,
    value: update.value,
  });

  return next.sort((a, b) => a.fieldId.localeCompare(b.fieldId));
}
