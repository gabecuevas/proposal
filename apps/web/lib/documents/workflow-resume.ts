"use client";

import {
  documentKindFromVariables,
  editorLayoutFromVariables,
  type WorkflowDocumentKind,
} from "@/lib/editor/document-kind";

/** Delivery step a draft was last on, remembered per browser. */
export type WorkflowResumeStep = "contact" | "edit" | "review";

const STORAGE_PREFIX = "senddox:workflow-step:";

export function rememberWorkflowStep(documentId: string, step: WorkflowResumeStep) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${documentId}`, step);
  } catch {
    // Storage can be unavailable (private mode, quota); resuming falls back to Edit Document.
  }
}

export function readWorkflowStep(documentId: string): WorkflowResumeStep | null {
  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${documentId}`);
    return value === "contact" || value === "edit" || value === "review" ? value : null;
  } catch {
    return null;
  }
}

export type WorkflowResumeTarget =
  | { type: "editor"; href: string }
  | { type: "panel"; kind: WorkflowDocumentKind; step: 2 | 3 | 4 };

/**
 * Where to reopen a draft: Add Contact / Review & Send live in the workflow
 * panel; Edit Document is the immersive editor for Flow/Quote/Invoice and the
 * panel's own editor step for legacy Creator drafts.
 */
export function workflowResumeTarget(input: {
  documentId: string;
  variables: unknown;
  hasRecipients: boolean;
}): WorkflowResumeTarget {
  const kind = documentKindFromVariables(input.variables);
  const remembered = readWorkflowStep(input.documentId);
  const step: WorkflowResumeStep =
    !input.hasRecipients ? "contact" : remembered === "review" ? "review" : remembered === "contact" ? "contact" : "edit";
  if (step === "contact") {
    return { type: "panel", kind, step: 2 };
  }
  if (step === "review") {
    return { type: "panel", kind, step: 4 };
  }
  const nativeEditor =
    kind === "quote" || kind === "invoice" || editorLayoutFromVariables(input.variables) === "flow";
  if (nativeEditor) {
    return { type: "editor", href: `/app/documents/${input.documentId}?afterUse=1` };
  }
  return { type: "panel", kind, step: 3 };
}
