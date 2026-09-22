"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CommercialBuilderModal } from "./commercial-builder-modal";
import type { CommercialDocType } from "@/lib/commercial/schema";

type OpenOptions = {
  type: CommercialDocType;
  documentId?: string | null;
};

type CommercialBuilderContextValue = {
  openBuilder: (options: OpenOptions) => void;
  closeBuilder: () => void;
};

const CommercialBuilderContext = createContext<CommercialBuilderContextValue | null>(null);

export function CommercialBuilderProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CommercialDocType>("quote");
  const [documentId, setDocumentId] = useState<string | null>(null);

  const openBuilder = useCallback((options: OpenOptions) => {
    setType(options.type);
    setDocumentId(options.documentId?.trim() || null);
    setOpen(true);
  }, []);

  const closeBuilder = useCallback(() => {
    setOpen(false);
    setDocumentId(null);
  }, []);

  const value = useMemo(
    () => ({ openBuilder, closeBuilder }),
    [openBuilder, closeBuilder],
  );

  return (
    <CommercialBuilderContext.Provider value={value}>
      {children}
      <CommercialBuilderModal
        open={open}
        type={type}
        documentId={documentId}
        onClose={closeBuilder}
        onDocumentId={(id) => setDocumentId(id)}
      />
    </CommercialBuilderContext.Provider>
  );
}

export function useCommercialBuilder(): CommercialBuilderContextValue {
  const ctx = useContext(CommercialBuilderContext);
  if (!ctx) {
    throw new Error("useCommercialBuilder must be used within CommercialBuilderProvider");
  }
  return ctx;
}
