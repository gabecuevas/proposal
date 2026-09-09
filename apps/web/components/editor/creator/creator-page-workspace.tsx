"use client";

import type { Editor } from "@tiptap/core";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { pageSizeSpec, type PageSizeId } from "@/lib/editor/page-geometry";
import { CreatorPagePropertiesPanel } from "./creator-page-properties";
import { CreatorPageStrip } from "./creator-page-strip";
import { ImportBackgroundModal } from "./import-background-modal";

type PageActions = {
  openPageProperties: (page: number) => void;
  openImportBackground: (page: number) => void;
};

const CreatorPageActionsContext = createContext<PageActions | null>(null);

export function useCreatorPageActions(): PageActions | null {
  return useContext(CreatorPageActionsContext);
}

type Props = {
  editor: Editor | null;
  name: string;
  pageCount: number;
  currentPage: number;
  pageSize: PageSizeId;
  onAddPage?: () => void;
  onPreviewPdf?: () => void;
  onDownloadPdf?: () => void;
  pdfBusy?: boolean;
  children: ReactNode;
};

export function CreatorPageWorkspace({
  editor,
  name,
  pageCount,
  currentPage,
  pageSize,
  onAddPage,
  onPreviewPdf,
  onDownloadPdf,
  pdfBusy = false,
  children,
}: Props) {
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [targetPage, setTargetPage] = useState(currentPage);
  const spec = pageSizeSpec(pageSize);
  const editingPage = Math.min(Math.max(1, targetPage), Math.max(1, pageCount));

  const openPageProperties = useCallback((page: number) => {
    setTargetPage(page);
    setPropertiesOpen(true);
  }, []);

  const openImportBackground = useCallback((page: number) => {
    setTargetPage(page);
    setImportOpen(true);
  }, []);

  const actions = useMemo(
    () => ({ openPageProperties, openImportBackground }),
    [openImportBackground, openPageProperties],
  );

  return (
    <CreatorPageActionsContext.Provider value={actions}>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CreatorPageStrip
            name={name}
            pageCount={pageCount}
            currentPage={currentPage}
            pageSizeLabel={spec.shortLabel}
            onAddPage={onAddPage}
            onPreviewPdf={onPreviewPdf}
            onDownloadPdf={onDownloadPdf}
            pdfBusy={pdfBusy}
          />
          {children}
        </div>
        {propertiesOpen ? (
          <CreatorPagePropertiesPanel
            editor={editor}
            currentPage={editingPage}
            pageSize={pageSize}
            onClose={() => setPropertiesOpen(false)}
            onImportBackground={() => setImportOpen(true)}
          />
        ) : null}
        <ImportBackgroundModal
          open={importOpen}
          editor={editor}
          currentPage={editingPage}
          pageSize={pageSize}
          onClose={() => setImportOpen(false)}
        />
      </div>
    </CreatorPageActionsContext.Provider>
  );
}
