"use client";

import type { DocumentCreateKind } from "@/lib/editor/document-kind";

export type CreateDocumentFromKindResult =
  | { action: "template"; href: string }
  | { action: "workflow"; kind: "proposal" }
  | { action: "commercial"; kind: "quote" | "invoice" }
  | { action: "flow"; documentId: string }
  | { action: "error"; message: string };

/**
 * Shared create routing for Library / Dashboard / Documents split buttons.
 * New Document → blank Flow Document. Proposal → Creator workflow.
 * Quote/Invoice → commercial builder. Template → editor.
 */
export async function createFromDocumentKind(
  kind: DocumentCreateKind,
  options?: { folderId?: string | null },
): Promise<CreateDocumentFromKindResult> {
  if (kind === "template") {
    const params = new URLSearchParams({ auto: "1" });
    if (options?.folderId) {
      params.set("folderId", options.folderId);
    }
    return { action: "template", href: `/app/templates/new?${params.toString()}` };
  }

  if (kind === "proposal") {
    return { action: "workflow", kind };
  }

  if (kind === "quote" || kind === "invoice") {
    return { action: "commercial", kind };
  }

  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "document", layout: "flow" }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    return {
      action: "error",
      message: payload.error || payload.message || "Could not create document",
    };
  }
  const data = (await response.json()) as { document?: { id?: string } };
  const documentId = data.document?.id;
  if (!documentId) {
    return { action: "error", message: "Unexpected create response" };
  }
  return { action: "flow", documentId };
}
