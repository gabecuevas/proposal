/** Pause after the last edit before an autosave PATCH. Google Docs is ~1–2s. */
export const AUTOSAVE_DELAY_MS = 1500;

/** Visible status next to the document title, Google Docs style. */
export function formatEditorSaveStatus(status: string): string {
  if (status === "Saving..." || status === "Saving…") {
    return "Saving…";
  }
  if (status === "Idle" || status === "Saved" || status === "Saved just now" || status.startsWith("Saved")) {
    return "Saved";
  }
  if (status === "Document sent.") {
    return "Sent";
  }
  return status;
}

export function isEditorSaving(status: string): boolean {
  return status === "Saving..." || status === "Saving…";
}

export function isEditorSaved(status: string): boolean {
  const label = formatEditorSaveStatus(status);
  return label === "Saved" || label === "Sent";
}
