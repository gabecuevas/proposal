const PAD = 6;

export function formatAccountId(accountNumber: number): string {
  return `ACC-${String(accountNumber).padStart(PAD, "0")}`;
}

export function formatUserId(userNumber: number): string {
  return `USR-${String(userNumber).padStart(PAD, "0")}`;
}

/** Parses "ACC-000123" / "usr-123" style search input. */
export function parsePublicId(input: string): { kind: "account" | "user"; number: number } | null {
  const match = /^(acc|usr)-?0*(\d{1,9})$/i.exec(input.trim());
  if (!match) {
    return null;
  }
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number <= 0) {
    return null;
  }
  return { kind: match[1]!.toLowerCase() === "acc" ? "account" : "user", number };
}
