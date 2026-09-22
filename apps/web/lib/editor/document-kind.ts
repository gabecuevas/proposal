export const DOCUMENT_CREATE_KINDS = ["document", "template", "proposal", "quote", "invoice"] as const;

export type DocumentCreateKind = (typeof DOCUMENT_CREATE_KINDS)[number];

/** Kinds that open the New Document workflow (not the template editor). */
export const WORKFLOW_DOCUMENT_KINDS = ["document", "proposal", "quote", "invoice"] as const;
export type WorkflowDocumentKind = (typeof WORKFLOW_DOCUMENT_KINDS)[number];

/** Editor layout: Flow = Google Docs–style continuous doc; Creator = page/overlay canvas; Commercial = Quote/Invoice builder. */
export const EDITOR_LAYOUTS = ["flow", "creator", "commercial"] as const;
export type EditorLayout = (typeof EDITOR_LAYOUTS)[number];

export type DocumentKindProfile = {
  id: DocumentCreateKind;
  label: string;
  /** Short noun used in empty titles, e.g. "Proposal". */
  noun: string;
  blankTitle: string;
  workflowTitle: string;
  deliveryIntro: string;
};

const PROFILES: Record<DocumentCreateKind, DocumentKindProfile> = {
  document: {
    id: "document",
    label: "New Document",
    noun: "Document",
    blankTitle: "Untitled Document",
    workflowTitle: "New Document",
    deliveryIntro:
      "Hi {{recipient_full_name}},\n\nBelow is the link to the document. As you look through, please add any comments or questions. I look forward to your feedback!\n\nThanks,\n{{sender_full_name}}",
  },
  template: {
    id: "template",
    label: "New Template",
    noun: "Template",
    blankTitle: "Untitled Template",
    workflowTitle: "New Template",
    deliveryIntro: "",
  },
  proposal: {
    id: "proposal",
    label: "New Proposal",
    noun: "Proposal",
    blankTitle: "Untitled Proposal",
    workflowTitle: "New Proposal",
    deliveryIntro:
      "Hi {{recipient_full_name}},\n\nBelow is the link to the proposal. As you look through, please add any comments or questions. I look forward to your feedback!\n\nThanks,\n{{sender_full_name}}",
  },
  quote: {
    id: "quote",
    label: "New Quote",
    noun: "Quote",
    blankTitle: "Untitled Quote",
    workflowTitle: "New Quote",
    deliveryIntro:
      "Hi {{recipient_full_name}},\n\nPlease find your quote at the link below. Let me know if you have any questions.\n\nThanks,\n{{sender_full_name}}",
  },
  invoice: {
    id: "invoice",
    label: "New Invoice",
    noun: "Invoice",
    blankTitle: "Untitled Invoice",
    workflowTitle: "New Invoice",
    deliveryIntro:
      "Hi {{recipient_full_name}},\n\nPlease find your invoice at the link below. Let me know if you have any questions.\n\nThanks,\n{{sender_full_name}}",
  },
};

export function isDocumentCreateKind(value: unknown): value is DocumentCreateKind {
  return typeof value === "string" && (DOCUMENT_CREATE_KINDS as readonly string[]).includes(value);
}

export function isWorkflowDocumentKind(value: unknown): value is WorkflowDocumentKind {
  return typeof value === "string" && (WORKFLOW_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function documentKindProfile(kind: DocumentCreateKind | null | undefined): DocumentKindProfile {
  if (kind && isDocumentCreateKind(kind)) {
    return PROFILES[kind];
  }
  return PROFILES.document;
}

export function parseDocumentKind(value: unknown): WorkflowDocumentKind {
  return isWorkflowDocumentKind(value) ? value : "document";
}

/** Persist kind inside document variables_json until a dedicated column exists. */
export const DOCUMENT_KIND_VARIABLE_KEY = "document_kind";

/** Persist editor layout inside variables_json until a dedicated column exists. */
export const EDITOR_LAYOUT_VARIABLE_KEY = "editor_layout";

export function isEditorLayout(value: unknown): value is EditorLayout {
  return typeof value === "string" && (EDITOR_LAYOUTS as readonly string[]).includes(value);
}

export function parseEditorLayout(value: unknown): EditorLayout {
  return isEditorLayout(value) ? value : "creator";
}

/**
 * New Document (kind=document) defaults to Flow. Proposal keeps Creator.
 * Quote/Invoice use the commercial builder layout.
 */
export function defaultEditorLayoutForKind(kind: WorkflowDocumentKind): EditorLayout {
  if (kind === "document") {
    return "flow";
  }
  if (kind === "quote" || kind === "invoice") {
    return "commercial";
  }
  return "creator";
}

export function documentKindFromVariables(variables: unknown): WorkflowDocumentKind {
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    return "document";
  }
  return parseDocumentKind((variables as Record<string, unknown>)[DOCUMENT_KIND_VARIABLE_KEY]);
}

export function editorLayoutFromVariables(variables: unknown): EditorLayout {
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    return "creator";
  }
  const raw = (variables as Record<string, unknown>)[EDITOR_LAYOUT_VARIABLE_KEY];
  if (isEditorLayout(raw)) {
    return raw;
  }
  // Legacy docs without layout stay on Creator so existing drafts are unchanged.
  return "creator";
}

export function withDocumentKindVariables(
  variables: Record<string, unknown> | null | undefined,
  kind: WorkflowDocumentKind,
  layout?: EditorLayout,
): Record<string, unknown> {
  const resolvedLayout = layout ?? defaultEditorLayoutForKind(kind);
  return {
    ...(variables ?? {}),
    [DOCUMENT_KIND_VARIABLE_KEY]: kind,
    [EDITOR_LAYOUT_VARIABLE_KEY]: resolvedLayout,
  };
}

/**
 * Choose Flow vs Creator when spawning a document from a template.
 * Page-backed PDFs stay on Creator. Flow-tagged / editable DOCX templates open in Flow.
 */
export function editorLayoutForTemplateSource(input: {
  kind: WorkflowDocumentKind;
  tags?: string[] | null;
  pageBacked: boolean;
}): EditorLayout {
  if (input.pageBacked) {
    return "creator";
  }
  const lower = (input.tags ?? []).map((tag) => tag.toLowerCase());
  if (lower.includes("flow") || lower.includes("docx")) {
    return "flow";
  }
  return defaultEditorLayoutForKind(input.kind);
}
