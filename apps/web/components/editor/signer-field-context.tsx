"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SignerRecipientOption = { id: string; name: string };

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
