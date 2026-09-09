"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SignerRecipientOption = {
  id: string;
  name: string;
  email?: string;
  role?: "signer" | "sender" | "approver" | "viewer";
};

export const SENDER_RECIPIENT: SignerRecipientOption = {
  id: "sender-self",
  name: "You",
  role: "sender",
};

export function withSenderRecipient(recipients: SignerRecipientOption[]): SignerRecipientOption[] {
  if (recipients.some((recipient) => recipient.id === SENDER_RECIPIENT.id || recipient.role === "sender")) {
    return recipients;
  }
  return [SENDER_RECIPIENT, ...recipients];
}

const SignerRecipientContext = createContext<SignerRecipientOption[]>([]);

export function SignerRecipientProvider({
  recipients,
  children,
}: {
  recipients: SignerRecipientOption[];
  children: ReactNode;
}) {
  return <SignerRecipientContext.Provider value={recipients}>{children}</SignerRecipientContext.Provider>;
}

export function useSignerRecipients(): SignerRecipientOption[] {
  return useContext(SignerRecipientContext);
}
