"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NewDocumentWorkflowPanel } from "./new-document-workflow-panel";
import type { WorkflowDocumentKind } from "@/lib/editor/document-kind";

export type WorkflowStepId = 1 | 2 | 3 | 4;

type OpenWorkflowOptions = {
  kind?: WorkflowDocumentKind;
  /** Existing draft — skips Pick Template and starts at Add Contact (or initialStep). */
  documentId?: string;
  /** Library template — skips Pick Template, starts at Add Contact, creates from this template. */
  templateId?: string;
  templateName?: string;
  /** Jump to a step after open (e.g. 4 = Review & Send). */
  initialStep?: WorkflowStepId;
};

type NewDocumentWorkflowContextValue = {
  open: boolean;
  kind: WorkflowDocumentKind;
  documentId: string | null;
  templateId: string | null;
  templateName: string | null;
  initialStep: WorkflowStepId | null;
  openWorkflow: (options?: OpenWorkflowOptions) => void;
  closeWorkflow: () => void;
};

const NewDocumentWorkflowContext = createContext<NewDocumentWorkflowContextValue | null>(null);

export function NewDocumentWorkflowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WorkflowDocumentKind>("document");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [initialStep, setInitialStep] = useState<WorkflowStepId | null>(null);

  const openWorkflow = useCallback((options?: OpenWorkflowOptions) => {
    setKind(options?.kind ?? "document");
    setDocumentId(options?.documentId?.trim() || null);
    setTemplateId(options?.templateId?.trim() || null);
    setTemplateName(options?.templateName?.trim() || null);
    setInitialStep(options?.initialStep ?? null);
    setOpen(true);
  }, []);

  const closeWorkflow = useCallback(() => {
    setOpen(false);
    setDocumentId(null);
    setTemplateId(null);
    setTemplateName(null);
    setInitialStep(null);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        closeWorkflow();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeWorkflow, open]);

  const value = useMemo(
    () => ({
      open,
      kind,
      documentId,
      templateId,
      templateName,
      initialStep,
      openWorkflow,
      closeWorkflow,
    }),
    [open, kind, documentId, templateId, templateName, initialStep, openWorkflow, closeWorkflow],
  );

  return (
    <NewDocumentWorkflowContext.Provider value={value}>
      {children}
      <NewDocumentWorkflowPanel
        open={open}
        kind={kind}
        seedDocumentId={documentId}
        seedTemplateId={templateId}
        seedTemplateName={templateName}
        initialStep={initialStep}
        onClose={closeWorkflow}
      />
    </NewDocumentWorkflowContext.Provider>
  );
}

export function useNewDocumentWorkflow(): NewDocumentWorkflowContextValue {
  const ctx = useContext(NewDocumentWorkflowContext);
  if (!ctx) {
    throw new Error("useNewDocumentWorkflow must be used within NewDocumentWorkflowProvider");
  }
  return ctx;
}
