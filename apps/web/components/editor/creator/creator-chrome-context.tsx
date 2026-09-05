"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ContentLibraryModal } from "./content-library-modal";

type CreatorChrome = {
  documentId?: string;
  templateId?: string;
  openLibrary: () => void;
};

const CreatorChromeContext = createContext<CreatorChrome>({
  openLibrary: () => undefined,
});

export function CreatorChromeProvider({
  documentId,
  templateId,
  editor,
  children,
}: {
  documentId?: string;
  templateId?: string;
  editor: Editor | null;
  children: React.ReactNode;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const openLibrary = useCallback(() => setLibraryOpen(true), []);
  const value = useMemo(
    () => ({ documentId, templateId, openLibrary }),
    [documentId, templateId, openLibrary],
  );

  return (
    <CreatorChromeContext.Provider value={value}>
      {children}
      <ContentLibraryModal editor={editor} open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </CreatorChromeContext.Provider>
  );
}

export function useCreatorChrome(): CreatorChrome {
  return useContext(CreatorChromeContext);
}
