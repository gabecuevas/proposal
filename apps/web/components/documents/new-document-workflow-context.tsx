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

type NewDocumentWorkflowContextValue = {
  open: boolean;
  openWorkflow: () => void;
  closeWorkflow: () => void;
};

const NewDocumentWorkflowContext = createContext<NewDocumentWorkflowContextValue | null>(null);

export function NewDocumentWorkflowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openWorkflow = useCallback(() => setOpen(true), []);
  const closeWorkflow = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(
    () => ({ open, openWorkflow, closeWorkflow }),
    [open, openWorkflow, closeWorkflow],
  );

  return (
    <NewDocumentWorkflowContext.Provider value={value}>
      {children}
      <NewDocumentWorkflowPanel open={open} onClose={closeWorkflow} />
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
