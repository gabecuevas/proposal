const CLIPBOARD_KEY = "senddox-copied-signer-field";

export type CopiedSignerField = {
  type: "signerField";
  attrs: Record<string, unknown>;
};

export function copySignerFieldNode(json: CopiedSignerField): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(json));
  }
}

export function readCopiedSignerField(): CopiedSignerField | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(CLIPBOARD_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CopiedSignerField;
    if (parsed?.type !== "signerField" || !parsed.attrs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCopiedSignerField(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CLIPBOARD_KEY);
  }
}
