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

type OpenWorkflowOptions = {
  kind?: WorkflowDocumentKind;
  /** Existing draft — skips Pick Template and starts at Info (Add Contact). */
  documentId?: string;
};

type NewDocumentWorkflowContextValue = {
  open: boolean;
  kind: WorkflowDocumentKind;
  documentId: string | null;
  openWorkflow: (options?: OpenWorkflowOptions) => void;
  closeWorkflow: () => void;
};

const NewDocumentWorkflowContext = createContext<NewDocumentWorkflowContextValue | null>(null);

export function NewDocumentWorkflowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WorkflowDocumentKind>("document");
  const [documentId, setDocumentId] = useState<string | null>(null);

  const openWorkflow = useCallback((options?: OpenWorkflowOptions) => {
    setKind(options?.kind ?? "document");
    setDocumentId(options?.documentId?.trim() || null);
    setOpen(true);
  }, []);
  const closeWorkflow = useCallback(() => {
    setOpen(false);
    setDocumentId(null);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        setDocumentId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(
    () => ({ open, kind, documentId, openWorkflow, closeWorkflow }),
    [open, kind, documentId, openWorkflow, closeWorkflow],
  );

  return (
    <NewDocumentWorkflowContext.Provider value={value}>
      {children}
      <NewDocumentWorkflowPanel
        open={open}
        kind={kind}
        seedDocumentId={documentId}
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
