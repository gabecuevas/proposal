"use client";

import "@/components/flow-document/flow-document-prototype.css";

import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlowDocsChrome } from "@/components/flow-document/flow-docs-chrome";
import { FlowHeaderFooterLayer } from "@/components/flow-document/flow-header-footer";
import { HeadersFootersModal } from "@/components/flow-document/headers-footers-modal";
import { FlowTableContextMenu } from "@/components/flow-document/flow-table-context-menu";
import { TableOptionsModal } from "@/components/flow-document/table-options-modal";
import {
  createFlowDocumentExtensions,
  FLOW_EDITOR_DEFAULT_ATTRIBUTES,
  FLOW_PAPER_PRESETS,
  type FlowPaperId,
} from "@/lib/flow-document/extensions";
import { flowGoogleFontsStylesheetHref } from "@/lib/flow-document/google-fonts";
import { measurePaginationPlusPageCount } from "@/lib/flow-document/measure-pages";
import {
  applyFlowPageChromeToEditor,
  chromeNeedsPerPageSlots,
  DEFAULT_FLOW_PAGE_CHROME,
  flowPageChromeFromDoc,
  withFlowPageChrome,
  type FlowPageChromeState,
} from "@/lib/flow-document/page-chrome";
import {
  applyFlowTableOptions,
  clearAllFlowTableBorders,
  ensureFlowTableWidthPercents,
  readFlowTableOptions,
} from "@/lib/flow-document/table-commands";
import { DEFAULT_FLOW_TABLE_OPTIONS, type FlowTableOptionsState } from "@/lib/flow-document/table-extensions";
import {
  captureFlowPaginationSnapshot,
  ensureFlowDebugApi,
  isFlowPaginationDebugEnabled,
  logFlowPaginationSnapshot,
  logFlowPasteDebug,
  summarizePastedHtml,
} from "@/lib/flow-document/pagination-debug";
import { sanitizeFlowPastedHtml } from "@/lib/flow-document/paste";
import { runFlowClipboard } from "@/lib/flow-document/clipboard";
import {
  estimateContentPageCount,
  FLOW_PAGE_CONTENT_HEIGHT_PX,
  paginationLooksRunaway,
  syncFlowTableColumnLayout,
} from "@/lib/flow-document/table-pagination";
import {
  disableFlowPagination,
  enableFlowPagination,
} from "@/lib/flow-document/pagination-control";
import { AUTOSAVE_DELAY_MS } from "@/lib/editor/autosave";
import {
  redo,
  selectAll,
  undo,
} from "@/lib/editor/commands/editor-commands";
import { SaveQueue } from "@/lib/editor/save-queue";
import { serializeStable } from "@/lib/editor/stable";
import type { EditorDoc, VariableContext } from "@/lib/editor/types";
import { applyTitleToDoc, documentTitleFromEditorJson } from "@/lib/ui/document-title";
import { documentKindProfile, editorLayoutFromVariables } from "@/lib/editor/document-kind";

/** Soft cap — if float seams still runaway, pause briefly then recover. */
const FLOW_PAGE_RUNAWAY_THRESHOLD = 40;

type DocumentDetail = {
  id: string;
  status: string;
  editor_json: EditorDoc;
  variables_json: VariableContext;
  updated_at: string;
};

type Props = {
  documentId: string;
};

function statusLabel(status: string | undefined): string {
  if (!status || status === "DRAFTED") {
    return "Draft";
  }
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Production Flow Document editor — Google Docs–style chrome + continuous body.
 */
export function FlowDocumentEditor({ documentId }: Props) {
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [paper] = useState<FlowPaperId>("letter");
  const [pageCount, setPageCount] = useState(1);
  const [status, setStatus] = useState("Loading…");
  const [zoom, setZoom] = useState(100);
  const [pageChrome, setPageChrome] = useState<FlowPageChromeState>(DEFAULT_FLOW_PAGE_CHROME);
  const [headersModalOpen, setHeadersModalOpen] = useState(false);
  const [tableOptionsOpen, setTableOptionsOpen] = useState(false);
  const [tableOptionsInitial, setTableOptionsInitial] =
    useState<FlowTableOptionsState>(DEFAULT_FLOW_TABLE_OPTIONS);
  const [paginationPaused, setPaginationPaused] = useState(false);
  const pageChromeRef = useRef(pageChrome);
  pageChromeRef.current = pageChrome;
  const pageCountRef = useRef(1);
  const saveQueueRef = useRef(new SaveQueue());
  const expectedUpdatedAtRef = useRef("");
  const lastSavedSnapshotRef = useRef("");
  const nameRef = useRef(name);
  nameRef.current = name;
  const [serializedDoc, setSerializedDoc] = useState(() => serializeStable({ type: "doc", content: [] }));

  const extensions = useMemo(
    () => createFlowDocumentExtensions({ paper, pagination: true }),
    [paper],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: document?.editor_json,
      editorProps: {
        attributes: FLOW_EDITOR_DEFAULT_ATTRIBUTES,
        // Same Docs/Word paste pipeline as Creator — without this, layout styles,
        // fixed image sizes, and table widths from Google Docs blow PaginationPlus.
        transformPastedHTML(html) {
          const clean = sanitizeFlowPastedHtml(html);
          if (isFlowPaginationDebugEnabled()) {
            logFlowPasteDebug(summarizePastedHtml(html, clean));
          }
          return clean;
        },
      },
      onUpdate({ editor: next }) {
        const json = withFlowPageChrome(next.getJSON() as EditorDoc, pageChromeRef.current);
        setSerializedDoc(serializeStable(json));
        syncFlowTableColumnLayout(next.view.dom);
        if (isFlowPaginationDebugEnabled()) {
          // Defer so PaginationPlus can finish its rAF decoration pass.
          requestAnimationFrame(() => {
            logFlowPaginationSnapshot("onUpdate", next.view.dom);
          });
        }
      },
    },
    [extensions],
  );

  useEffect(() => {
    const href = flowGoogleFontsStylesheetHref();
    const existing = documentHeadLink(href);
    if (existing) {
      return;
    }
    const link = window.document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.flowGoogleFonts = "1";
    window.document.head.appendChild(link);
  }, []);

  const loadDocument = useCallback(async (id: string) => {
    setStatus("Loading…");
    setError("");
    const response = await fetch(`/api/documents/${id}`);
    if (!response.ok) {
      setError("Document not found");
      setStatus("Error");
      return;
    }
    const payload = (await response.json()) as { document: DocumentDetail };
    const doc = payload.document;
    if (editorLayoutFromVariables(doc.variables_json) !== "flow") {
      setError("This document is not a Flow Document.");
      setStatus("Error");
      return;
    }
    setDocument(doc);
    expectedUpdatedAtRef.current = doc.updated_at;
    const title = documentTitleFromEditorJson(doc.editor_json) || documentKindProfile("document").blankTitle;
    setName(title);
    const chrome = flowPageChromeFromDoc(doc.editor_json);
    setPageChrome(chrome);
    const snapshot = serializeStable(withFlowPageChrome(doc.editor_json, chrome));
    lastSavedSnapshotRef.current = snapshot;
    setSerializedDoc(snapshot);
    setStatus("Ready");
  }, []);

  useEffect(() => {
    void loadDocument(documentId);
  }, [documentId, loadDocument]);

  useEffect(() => {
    pageCountRef.current = pageCount;
  }, [pageCount]);

  useEffect(() => {
    function onOpenModal() {
      setHeadersModalOpen(true);
    }
    function onOpenTableOptions() {
      if (!editor || !editor.isActive("table")) {
        return;
      }
      setTableOptionsInitial(readFlowTableOptions(editor));
      setTableOptionsOpen(true);
    }
    window.addEventListener("flow-open-headers-footers-modal", onOpenModal);
    window.addEventListener("flow-open-table-options-modal", onOpenTableOptions);
    return () => {
      window.removeEventListener("flow-open-headers-footers-modal", onOpenModal);
      window.removeEventListener("flow-open-table-options-modal", onOpenTableOptions);
    };
  }, [editor]);

  const applyChrome = useCallback(
    (next: FlowPageChromeState) => {
      if (!editor) {
        return;
      }
      const paperSize = FLOW_PAPER_PRESETS[paper].size;
      applyFlowPageChromeToEditor(editor, next, {
        pageCount: pageCountRef.current,
        marginLeftPx: paperSize.marginLeft,
        marginRightPx: paperSize.marginRight,
      });
    },
    [editor, paper],
  );

  useEffect(() => {
    if (!editor || !document) {
      return;
    }
    const chrome = flowPageChromeFromDoc(document.editor_json);
    const content = document.editor_json;
    editor.commands.setContent(content);
    enableFlowPagination(editor);
    setPaginationPaused(false);
    requestAnimationFrame(() => {
      syncFlowTableColumnLayout(editor.view.dom);
      enableFlowPagination(editor);
    });
    applyFlowPageChromeToEditor(editor, chrome, {
      pageCount: 1,
      marginLeftPx: FLOW_PAPER_PRESETS[paper].size.marginLeft,
      marginRightPx: FLOW_PAPER_PRESETS[paper].size.marginRight,
    });
  }, [editor, document?.id, paper]); // eslint-disable-line react-hooks/exhaustive-deps -- load once per doc

  const handlePageChromeChange = useCallback(
    (next: FlowPageChromeState) => {
      setPageChrome(next);
      pageChromeRef.current = next;
      applyChrome(next);
      if (!editor) {
        return;
      }
      const json = withFlowPageChrome(editor.getJSON() as EditorDoc, next);
      setSerializedDoc(serializeStable(json));
    },
    [applyChrome, editor],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    ensureFlowDebugApi(
      () => editor.view.dom as HTMLElement,
      {
        pasteHtml: (html: string) => {
          const clean = sanitizeFlowPastedHtml(html);
          logFlowPasteDebug(summarizePastedHtml(html, clean));
          editor.chain().focus().clearContent().insertContent(clean).run();
          ensureFlowTableWidthPercents(editor);
        },
        selectAll: () => selectAll(editor),
        clearDoc: () => editor.chain().focus().selectAll().deleteSelection().run(),
        clearTableBorders: () => clearAllFlowTableBorders(editor),
      },
    );

    const measure = () => {
      ensureFlowTableWidthPercents(editor);
      syncFlowTableColumnLayout(editor.view.dom);

      // Always keep PaginationPlus on — table rows are laid out to flow through seams.
      if (editor.storage.PaginationPlus?.enabled === false && !paginationPaused) {
        enableFlowPagination(editor);
      }

      const pages = measurePaginationPlusPageCount(editor.view.dom);
      const estimated = estimateContentPageCount(editor.view.dom, FLOW_PAGE_CONTENT_HEIGHT_PX);
      const snap = isFlowPaginationDebugEnabled()
        ? logFlowPaginationSnapshot("measure", editor.view.dom, { estimated })
        : captureFlowPaginationSnapshot(editor.view.dom);

      if (
        paginationLooksRunaway({
          widgetPages: pages,
          estimatedPages: estimated,
          lastGapPx: snap?.lastGapPx ?? null,
        })
      ) {
        console.warn("[flow] pagination runaway — resetting seams", { pages, estimated, gap: snap?.lastGapPx });
        disableFlowPagination(editor);
        requestAnimationFrame(() => {
          syncFlowTableColumnLayout(editor.view.dom);
          enableFlowPagination(editor);
          setPaginationPaused(false);
        });
        setPageCount(estimated);
        return;
      }

      if (pages > 0) {
        setPageCount((prev) => (prev === pages ? prev : pages));
      } else if (estimated > 0) {
        setPageCount((prev) => (prev === estimated ? prev : estimated));
      }

      if (
        !paginationPaused &&
        pages >= FLOW_PAGE_RUNAWAY_THRESHOLD &&
        (snap?.lastGapPx ?? 0) > 40
      ) {
        disableFlowPagination(editor);
        setPaginationPaused(true);
        setPageCount(estimated);
        console.warn("[flow] pagination paused — runaway page growth detected", snap);
      }
    };
    measure();
    const id = window.setInterval(measure, 750);
    return () => window.clearInterval(id);
  }, [editor, paper, serializedDoc, paginationPaused]);

  useEffect(() => {
    if (!editor || pageCount < 1 || paginationPaused) {
      return;
    }
    // Skip pageCount-driven re-apply when chrome has no per-page slots — otherwise
    // every PaginationPlus page bump rewrites customHeader maps and can feed growth.
    if (!chromeNeedsPerPageSlots(pageChromeRef.current)) {
      return;
    }
    applyChrome(pageChromeRef.current);
  }, [applyChrome, editor, pageCount, paginationPaused]);

  const persist = useCallback(
    async (editorJson: EditorDoc, nextName: string) => {
      if (!document) {
        return;
      }
      const withChrome = withFlowPageChrome(editorJson, pageChromeRef.current);
      const withTitle = applyTitleToDoc(withChrome, nextName.trim() || documentKindProfile("document").blankTitle);
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editor_json: withTitle,
          expectedUpdatedAt: expectedUpdatedAtRef.current || undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Save failed");
      }
      const payload = (await response.json()) as { document: DocumentDetail };
      expectedUpdatedAtRef.current = payload.document.updated_at;
      setDocument(payload.document);
      lastSavedSnapshotRef.current = serializeStable(withTitle);
    },
    [document],
  );

  useEffect(() => {
    if (!document || !editor || document.status !== "DRAFTED") {
      return;
    }
    if (serializedDoc === lastSavedSnapshotRef.current) {
      return;
    }
    setStatus("Saving…");
    const handle = window.setTimeout(() => {
      void saveQueueRef.current
        .run(() => persist(JSON.parse(serializedDoc) as EditorDoc, nameRef.current))
        .then(() => setStatus("Saved"))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Save failed");
          setStatus("Error");
        });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [serializedDoc, document, editor, persist]);

  const renameDocument = useCallback(
    (next: string) => {
      setName(next);
      if (!editor) {
        return;
      }
      const json = applyTitleToDoc(editor.getJSON() as EditorDoc, next);
      editor.commands.setContent(json);
      setSerializedDoc(serializeStable(json));
    },
    [editor],
  );

  const saveNow = useCallback(async () => {
    if (!editor) {
      return;
    }
    setStatus("Saving…");
    try {
      await saveQueueRef.current.run(() => persist(editor.getJSON() as EditorDoc, nameRef.current));
      setStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("Error");
    }
  }, [editor, persist]);

  const locked = Boolean(document && document.status !== "DRAFTED");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "s") {
        event.preventDefault();
        void saveNow();
        return;
      }
      if (mod && key === "p") {
        event.preventDefault();
        window.print();
        return;
      }

      if (!editor || locked) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) {
        return;
      }

      // Ensure document shortcuts land in the editor even if a hotspot/chrome node had focus.
      const ensureEditorFocus = () => {
        if (!editor.view.hasFocus()) {
          editor.chain().focus().run();
        }
      };

      if (mod && key === "a") {
        event.preventDefault();
        selectAll(editor);
        return;
      }
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        ensureEditorFocus();
        undo(editor);
        return;
      }
      if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        ensureEditorFocus();
        redo(editor);
        return;
      }
      // When focus is outside ProseMirror (hotspot/chrome), handle clipboard ourselves.
      // When the editor already has focus, let TipTap/ProseMirror own cut/copy/paste
      // so transformPastedHTML runs for Cmd/Ctrl+V.
      if (mod && (key === "x" || key === "c" || key === "v") && !editor.view.hasFocus()) {
        event.preventDefault();
        const action = key === "x" ? "cut" : key === "c" ? "copy" : "paste";
        void runFlowClipboard(editor, action);
        return;
      }

      // After Select-all, Delete/Backspace should clear the doc even if focus slipped.
      if (!mod && (key === "backspace" || key === "delete")) {
        const { empty, from, to } = editor.state.selection;
        const docSize = editor.state.doc.content.size;
        const coversDoc = !empty && to - from >= Math.max(1, docSize - 4);
        if (coversDoc) {
          event.preventDefault();
          editor.chain().focus().deleteSelection().run();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, locked, saveNow]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (!url || !editor) {
      return;
    }
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertPageBreak = useCallback(() => {
    editor?.chain().focus().insertContent({ type: "pageBreak" }).run();
  }, [editor]);

  const addComment = useCallback(async () => {
    if (!document) {
      return;
    }
    const body = window.prompt("Add a comment");
    if (!body?.trim()) {
      return;
    }
    const response = await fetch(`/api/documents/${document.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body.trim() }),
    });
    if (!response.ok) {
      setError("Could not add comment");
      return;
    }
    setStatus("Comment added");
  }, [document]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!locked);
  }, [editor, locked]);

  if (!document && !error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f9fbfd]">
        <p className="text-sm text-[#5f6368]">Loading document…</p>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f9fbfd]">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/app/documents" className="text-sm text-[#1a73e8] underline">
          Back to Documents
        </Link>
      </div>
    );
  }

  return (
    <div className="flow-document-shell flex h-screen w-full flex-col bg-[#f9fbfd]">
      <FlowDocsChrome
        editor={editor}
        name={name}
        onNameChange={renameDocument}
        saveStatus={status}
        statusLabel={statusLabel(document?.status)}
        locked={locked}
        onSave={() => void saveNow()}
        onPrint={() => window.print()}
        onInsertImage={insertImage}
        onInsertTable={insertTable}
        onInsertPageBreak={insertPageBreak}
        onAddComment={() => void addComment()}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      {error ? <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p> : null}
      {isFlowPaginationDebugEnabled() ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 font-mono text-xs text-amber-900">
          flowDebug on · pages={pageCount} · dump via window.__flowDebug.dump() · pastes logged on paste
        </p>
      ) : null}
      {paginationPaused ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <span>Page seams paused after unstable pagination. Layout was reset — resume to continue.</span>
          <button
            type="button"
            className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950"
            onClick={() => {
              if (!editor) {
                return;
              }
              syncFlowTableColumnLayout(editor.view.dom);
              enableFlowPagination(editor);
              setPaginationPaused(false);
            }}
          >
            Resume page seams
          </button>
        </div>
      ) : null}
      {locked ? (
        <p className="border-b border-[#dadce0] bg-white px-4 py-2 text-sm text-[#5f6368]">
          This sent version is locked. Open a new draft to keep editing.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="flow-document-paper-frame mx-auto origin-top px-4 py-8"
          style={{
            width: `${Math.round(816 * (zoom / 100) + 32)}px`,
            maxWidth: "100%",
          }}
        >
          <div
            className="flow-paper-stage relative"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              width: "816px",
              margin: "0 auto",
            }}
          >
            <FlowHeaderFooterLayer
              editor={editor}
              chrome={pageChrome}
              onChromeChange={handlePageChromeChange}
              locked={locked}
              zoom={zoom}
            />
            {editor ? <EditorContent editor={editor} /> : null}
            <FlowTableContextMenu editor={editor} locked={locked} />
          </div>
        </div>
        <p className="sr-only">{pageCount} pages</p>
      </div>

      <HeadersFootersModal
        open={headersModalOpen}
        chrome={pageChrome}
        onClose={() => setHeadersModalOpen(false)}
        onApply={handlePageChromeChange}
      />
      <TableOptionsModal
        open={tableOptionsOpen}
        initial={tableOptionsInitial}
        onClose={() => setTableOptionsOpen(false)}
        onApply={(next) => {
          if (!editor) {
            return;
          }
          applyFlowTableOptions(editor, next);
        }}
      />
    </div>
  );
}

function documentHeadLink(href: string): HTMLLinkElement | null {
  return window.document.head.querySelector(`link[href="${href}"]`);
}
