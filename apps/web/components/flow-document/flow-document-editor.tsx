"use client";

import "@/components/flow-document/flow-document-prototype.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNewDocumentWorkflow } from "@/components/documents/new-document-workflow-context";
import { SaveAsModal } from "@/components/editor/creator/save-as-modal";
import { FlowDocsChrome } from "@/components/flow-document/flow-docs-chrome";
import type { FlowActionsMenuItem } from "@/components/flow-document/flow-actions-menu";
import { FlowHeaderFooterLayer } from "@/components/flow-document/flow-header-footer";
import { HeadersFootersModal } from "@/components/flow-document/headers-footers-modal";
import { FlowMarginRulers } from "@/components/flow-document/flow-margin-rulers";
import { FlowPageNav, readFlowVisiblePage } from "@/components/flow-document/flow-page-nav";
import { FlowPageOverlays } from "@/components/flow-document/flow-page-overlays";
import { FlowPagePropertiesPanel } from "@/components/flow-document/flow-page-properties";
import { FlowToolShelf } from "@/components/flow-document/flow-tool-shelf";
import { FlowVariablesPanel } from "@/components/flow-document/flow-variables-panel";
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
  duplicateFlowPage,
  insertBlankFlowPageAfter,
} from "@/lib/flow-document/page-actions";
import type { FlowPageBand } from "@/lib/flow-document/page-bands";
import {
  flowPageBackgroundsFromDoc,
  patchFlowPageBackground,
  withFlowPageBackgrounds,
} from "@/lib/flow-document/page-backgrounds";
import { countVariableUsages } from "@/lib/flow-document/variable-catalog";
import {
  applyFlowPageChromeToEditor,
  chromeNeedsPerPageSlots,
  DEFAULT_FLOW_PAGE_CHROME,
  flowPageChromeFromDoc,
  withFlowPageChrome,
  type FlowPageChromeState,
} from "@/lib/flow-document/page-chrome";
import {
  clampFlowPageMargins,
  DEFAULT_FLOW_PAGE_MARGINS,
  detectMarginsFromPastedHtml,
  flowPageMarginsFromDoc,
  marginsToPaginationPx,
  withFlowPageMargins,
  type FlowPageMargins,
} from "@/lib/flow-document/page-margins";
import {
  BACKGROUND_IMAGE_EXTENSIONS,
  duplicatePageBackgrounds,
  type PageBackground,
  type PageBackgrounds,
} from "@/lib/editor/page-backgrounds";
import { isSupportedImage, uploadAsset } from "@/lib/editor/insert-elements";
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
  forceFlowPaginationRefresh,
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
import { unwrapTextBoxesInEditorDoc } from "@/lib/flow-document/normalize-content";
import { UseTemplateRecipientModal } from "@/components/templates/use-template-recipient-modal";

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
  documentId?: string;
  /** When set, load/save a Library template in Flow (editable DOCX / Flow saves). */
  templateId?: string;
  initialName?: string;
  initialDoc?: EditorDoc;
  closeHref?: string;
  masterPreview?: boolean;
};

function statusLabel(status: string | undefined): string {
  if (!status || status === "DRAFTED") {
    return "Draft";
  }
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Production Flow Document editor — Google Docs–style chrome + continuous body.
 * Also edits continuous Library templates (DOCX import / Save as Template).
 */
export function FlowDocumentEditor({
  documentId,
  templateId,
  initialName,
  initialDoc,
  closeHref = "/app/documents",
  masterPreview = false,
}: Props) {
  const router = useRouter();
  const { openWorkflow } = useNewDocumentWorkflow();
  const isTemplate = Boolean(templateId);
  const [document, setDocument] = useState<DocumentDetail | null>(() => {
    if (templateId && initialDoc) {
      return {
        id: templateId,
        status: "DRAFTED",
        editor_json: initialDoc,
        variables_json: {},
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  });
  const [error, setError] = useState("");
  const [name, setName] = useState(initialName ?? "");
  const [paper] = useState<FlowPaperId>("letter");
  const [pageCount, setPageCount] = useState(1);
  const [status, setStatus] = useState(initialDoc ? "Ready" : "Loading…");
  const [zoom, setZoom] = useState(100);
  const [showRulers, setShowRulers] = useState(true);
  const [pageMargins, setPageMargins] = useState<FlowPageMargins>({ ...DEFAULT_FLOW_PAGE_MARGINS });
  const [pageChrome, setPageChrome] = useState<FlowPageChromeState>(DEFAULT_FLOW_PAGE_CHROME);
  const [pageBackgrounds, setPageBackgrounds] = useState<PageBackgrounds>({});
  const [propertiesPage, setPropertiesPage] = useState<number | null>(null);
  const [activeShelfPanel, setActiveShelfPanel] = useState<"variables" | "page" | null>(null);
  const [variablesContext, setVariablesContext] = useState<VariableContext>({});
  const [headersModalOpen, setHeadersModalOpen] = useState(false);
  const [tableOptionsOpen, setTableOptionsOpen] = useState(false);
  const [tableOptionsInitial, setTableOptionsInitial] =
    useState<FlowTableOptionsState>(DEFAULT_FLOW_TABLE_OPTIONS);
  const [paginationPaused, setPaginationPaused] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [saveAsTemplateBusy, setSaveAsTemplateBusy] = useState(false);
  const [saveAsTemplateError, setSaveAsTemplateError] = useState("");
  const [useTemplateOpen, setUseTemplateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageChromeRef = useRef(pageChrome);
  pageChromeRef.current = pageChrome;
  const pageMarginsRef = useRef(pageMargins);
  pageMarginsRef.current = pageMargins;
  const pageBackgroundsRef = useRef(pageBackgrounds);
  pageBackgroundsRef.current = pageBackgrounds;
  const paperStageRef = useRef<HTMLDivElement | null>(null);
  const variablesContextRef = useRef(variablesContext);
  variablesContextRef.current = variablesContext;
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  const pendingPasteMarginsRef = useRef<Partial<FlowPageMargins> | null>(null);
  const scrollPaneRef = useRef<HTMLDivElement>(null);
  const pageCountRef = useRef(1);
  const saveQueueRef = useRef(new SaveQueue());
  const expectedUpdatedAtRef = useRef("");
  const lastSavedSnapshotRef = useRef("");
  const nameRef = useRef(name);
  nameRef.current = name;
  const [serializedDoc, setSerializedDoc] = useState(() =>
    serializeStable(initialDoc ?? { type: "doc", content: [] }),
  );
  const locked = masterPreview || Boolean(document && !isTemplate && document.status !== "DRAFTED");

  const stampFlowAttrs = useCallback((doc: EditorDoc) => {
    return withFlowPageBackgrounds(
      withFlowPageMargins(withFlowPageChrome(doc, pageChromeRef.current), pageMarginsRef.current),
      pageBackgroundsRef.current,
    );
  }, []);

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
          const detected = detectMarginsFromPastedHtml(html);
          if (detected) {
            pendingPasteMarginsRef.current = detected;
          }
          const clean = sanitizeFlowPastedHtml(html);
          if (isFlowPaginationDebugEnabled()) {
            logFlowPasteDebug(summarizePastedHtml(html, clean));
          }
          return clean;
        },
      },
      onUpdate({ editor: next }) {
        const pending = pendingPasteMarginsRef.current;
        if (pending) {
          pendingPasteMarginsRef.current = null;
          const paperSize = FLOW_PAPER_PRESETS[paper].size;
          const merged = clampFlowPageMargins(
            { ...pageMarginsRef.current, ...pending },
            paperSize.pageWidth / 96,
            paperSize.pageHeight / 96,
          );
          pageMarginsRef.current = merged;
          setPageMargins(merged);
          applyFlowPageChromeToEditor(next, pageChromeRef.current, {
            pageCount: pageCountRef.current,
            marginTopPx: marginsToPaginationPx(merged).top,
            marginRightPx: marginsToPaginationPx(merged).right,
            marginBottomPx: marginsToPaginationPx(merged).bottom,
            marginLeftPx: marginsToPaginationPx(merged).left,
          });
        }
        const json = stampFlowAttrs(next.getJSON() as EditorDoc);
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
    [extensions, paper, stampFlowAttrs],
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
    const editorJson = unwrapTextBoxesInEditorDoc(doc.editor_json);
    setDocument({ ...doc, editor_json: editorJson });
    expectedUpdatedAtRef.current = doc.updated_at;
    const title = documentTitleFromEditorJson(editorJson) || documentKindProfile("document").blankTitle;
    setName(title);
    const chrome = flowPageChromeFromDoc(editorJson);
    setPageChrome(chrome);
    const backgrounds = flowPageBackgroundsFromDoc(editorJson);
    setPageBackgrounds(backgrounds);
    pageBackgroundsRef.current = backgrounds;
    setVariablesContext(doc.variables_json ?? {});
    variablesContextRef.current = doc.variables_json ?? {};
    const snapshot = serializeStable(
      withFlowPageBackgrounds(withFlowPageChrome(editorJson, chrome), backgrounds),
    );
    lastSavedSnapshotRef.current = snapshot;
    setSerializedDoc(snapshot);
    setStatus("Ready");
  }, []);

  const loadTemplate = useCallback(async (id: string) => {
    setStatus("Loading…");
    setError("");
    const response = await fetch(`/api/templates/${id}`);
    if (!response.ok) {
      setError("Template not found");
      setStatus("Error");
      return;
    }
    const payload = (await response.json()) as {
      template: { id: string; name: string; editor_json: EditorDoc; updated_at?: string };
    };
    const tpl = payload.template;
    const editorJson = unwrapTextBoxesInEditorDoc(tpl.editor_json);
    const detail: DocumentDetail = {
      id: tpl.id,
      status: "DRAFTED",
      editor_json: editorJson,
      variables_json: {},
      updated_at: tpl.updated_at ?? new Date().toISOString(),
    };
    setDocument(detail);
    expectedUpdatedAtRef.current = detail.updated_at;
    const title =
      tpl.name?.trim() ||
      documentTitleFromEditorJson(editorJson) ||
      "Untitled Template";
    setName(title);
    const chrome = flowPageChromeFromDoc(editorJson);
    setPageChrome(chrome);
    const backgrounds = flowPageBackgroundsFromDoc(editorJson);
    setPageBackgrounds(backgrounds);
    pageBackgroundsRef.current = backgrounds;
    setVariablesContext({});
    variablesContextRef.current = {};
    const snapshot = serializeStable(
      withFlowPageBackgrounds(withFlowPageChrome(editorJson, chrome), backgrounds),
    );
    lastSavedSnapshotRef.current = snapshot;
    setSerializedDoc(snapshot);
    setStatus("Ready");
  }, []);

  useEffect(() => {
    if (templateId) {
      if (initialDoc) {
        const editorJson = unwrapTextBoxesInEditorDoc(initialDoc);
        const chrome = flowPageChromeFromDoc(editorJson);
        setPageChrome(chrome);
        const backgrounds = flowPageBackgroundsFromDoc(editorJson);
        setPageBackgrounds(backgrounds);
        pageBackgroundsRef.current = backgrounds;
        const snapshot = serializeStable(
          withFlowPageBackgrounds(withFlowPageChrome(editorJson, chrome), backgrounds),
        );
        lastSavedSnapshotRef.current = snapshot;
        setSerializedDoc(snapshot);
        setStatus("Ready");
        return;
      }
      void loadTemplate(templateId);
      return;
    }
    if (documentId) {
      void loadDocument(documentId);
    }
  }, [documentId, templateId, initialDoc, loadDocument, loadTemplate]);

  useEffect(() => {
    pageCountRef.current = pageCount;
  }, [pageCount]);

  useEffect(() => {
    const scroller = scrollPaneRef.current;
    const stage = paperStageRef.current;
    if (!scroller || !stage) {
      return;
    }
    const pageHeightPx = FLOW_PAPER_PRESETS[paper].size.pageHeight;
    const update = () => {
      const stageEl = paperStageRef.current;
      const pane = scrollPaneRef.current;
      if (!stageEl || !pane) {
        return;
      }
      const visible = readFlowVisiblePage(pane, stageEl, pageHeightPx, 32, zoom);
      setCurrentPage((prev) => {
        const next = Math.min(Math.max(1, visible), Math.max(1, pageCount));
        return prev === next ? prev : next;
      });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [pageCount, paper, zoom, serializedDoc]);

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
    (next: FlowPageChromeState, margins: FlowPageMargins = pageMarginsRef.current) => {
      if (!editor) {
        return;
      }
      const px = marginsToPaginationPx(margins);
      applyFlowPageChromeToEditor(editor, next, {
        pageCount: pageCountRef.current,
        marginTopPx: px.top,
        marginRightPx: px.right,
        marginBottomPx: px.bottom,
        marginLeftPx: px.left,
      });
    },
    [editor],
  );

  useEffect(() => {
    if (!editor || !document) {
      return;
    }
    const chrome = flowPageChromeFromDoc(document.editor_json);
    const margins = flowPageMarginsFromDoc(document.editor_json);
    setPageMargins(margins);
    pageMarginsRef.current = margins;
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
      marginTopPx: marginsToPaginationPx(margins).top,
      marginRightPx: marginsToPaginationPx(margins).right,
      marginBottomPx: marginsToPaginationPx(margins).bottom,
      marginLeftPx: marginsToPaginationPx(margins).left,
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
      const json = stampFlowAttrs(editor.getJSON() as EditorDoc);
      setSerializedDoc(serializeStable(json));
    },
    [applyChrome, editor, stampFlowAttrs],
  );

  const handleMarginsChange = useCallback(
    (next: FlowPageMargins) => {
      const paperSize = FLOW_PAPER_PRESETS[paper].size;
      const clamped = clampFlowPageMargins(
        next,
        paperSize.pageWidth / 96,
        paperSize.pageHeight / 96,
      );
      setPageMargins(clamped);
      pageMarginsRef.current = clamped;
      applyChrome(pageChromeRef.current, clamped);
      if (!editor) {
        return;
      }
      const json = stampFlowAttrs(editor.getJSON() as EditorDoc);
      setSerializedDoc(serializeStable(json));
      requestAnimationFrame(() => {
        syncFlowTableColumnLayout(editor.view.dom);
        forceFlowPaginationRefresh(editor);
      });
    },
    [applyChrome, editor, paper, stampFlowAttrs],
  );

  const commitBackgrounds = useCallback(
    (next: PageBackgrounds) => {
      setPageBackgrounds(next);
      pageBackgroundsRef.current = next;
      if (!editor) {
        return;
      }
      setSerializedDoc(serializeStable(stampFlowAttrs(editor.getJSON() as EditorDoc)));
    },
    [editor, stampFlowAttrs],
  );

  const handleBackgroundPatch = useCallback(
    (pageIndex: number, patch: Partial<PageBackground>) => {
      commitBackgrounds(patchFlowPageBackground(pageBackgroundsRef.current, pageIndex, patch));
    },
    [commitBackgrounds],
  );

  const handleClearBackground = useCallback(
    (pageIndex: number) => {
      commitBackgrounds(
        patchFlowPageBackground(pageBackgroundsRef.current, pageIndex, {
          color: null,
          imageKey: null,
        }),
      );
    },
    [commitBackgrounds],
  );

  const handleAddBlankPage = useCallback(
    (pageIndex: number, band: FlowPageBand) => {
      if (!editor || locked) {
        return;
      }
      insertBlankFlowPageAfter(editor, pageIndex, band.top, band.height);
    },
    [editor, locked],
  );

  const handleDuplicatePage = useCallback(() => {
    if (!editor || locked || propertiesPage == null) {
      return;
    }
    const pageIndex = propertiesPage - 1;
    const pageHeight = FLOW_PAPER_PRESETS[paper].size.pageHeight;
    const ok = duplicateFlowPage(editor, pageIndex, pageIndex * pageHeight, pageHeight);
    if (ok) {
      commitBackgrounds(duplicatePageBackgrounds(pageBackgroundsRef.current, pageIndex));
      setPropertiesPage(propertiesPage + 1);
    }
  }, [commitBackgrounds, editor, locked, paper, propertiesPage]);

  const handleImportBackground = useCallback(() => {
    backgroundFileRef.current?.click();
  }, []);

  const openPageProperties = useCallback((page: number) => {
    setPropertiesPage(page);
    setActiveShelfPanel("page");
  }, []);

  const handleVariablesChange = useCallback(
    (next: VariableContext) => {
      setVariablesContext(next);
      variablesContextRef.current = next;
      // Trigger autosave via serializedDoc bump while keeping editor JSON stable.
      if (editor) {
        setSerializedDoc(serializeStable(stampFlowAttrs(editor.getJSON() as EditorDoc)));
      }
      setStatus("Saving…");
      window.setTimeout(() => {
        void saveQueueRef.current
          .run(async () => {
            if (!document) {
              return;
            }
            const response = await fetch(`/api/documents/${document.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                variables_json: next,
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
          })
          .then(() => setStatus("Saved"))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Save failed");
            setStatus("Error");
          });
      }, 0);
    },
    [document, editor, stampFlowAttrs],
  );

  const variableUsageTotal = useMemo(() => {
    try {
      const counts = countVariableUsages(JSON.parse(serializedDoc) as EditorDoc);
      return Object.values(counts).reduce((sum, n) => sum + n, 0);
    } catch {
      return 0;
    }
  }, [serializedDoc]);

  const handleBackgroundFile = useCallback(
    async (file: File | undefined) => {
      if (!file || propertiesPage == null) {
        return;
      }
      if (!isSupportedImage(file)) {
        setError("Use a PNG, JPEG, or WebP image for the page background.");
        return;
      }
      try {
        const asset = await uploadAsset(file);
        handleBackgroundPatch(propertiesPage - 1, {
          imageKey: asset.key,
          imageFit: "fill",
          imagePosition: "top-left",
          imageRepeat: false,
          imageOpacity: 100,
        });
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Background upload failed");
      }
    },
    [handleBackgroundPatch, propertiesPage],
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
      const stamped = stampFlowAttrs(editorJson);
      const withTitle = applyTitleToDoc(
        stamped,
        nextName.trim() || (isTemplate ? "Untitled Template" : documentKindProfile("document").blankTitle),
      );
      if (isTemplate) {
        const response = await fetch(`/api/templates/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nextName.trim() || "Untitled Template",
            editor_json: withTitle,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Save failed");
        }
        const payload = (await response.json()) as {
          template: { id: string; name: string; editor_json: EditorDoc; updated_at?: string };
        };
        expectedUpdatedAtRef.current = payload.template.updated_at ?? new Date().toISOString();
        setDocument({
          id: payload.template.id,
          status: "DRAFTED",
          editor_json: payload.template.editor_json,
          variables_json: {},
          updated_at: expectedUpdatedAtRef.current,
        });
        lastSavedSnapshotRef.current = serializeStable(withTitle);
        return;
      }
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editor_json: withTitle,
          variables_json: variablesContextRef.current,
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
    [document, isTemplate, stampFlowAttrs],
  );

  useEffect(() => {
    if (!document || !editor || locked) {
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
  }, [serializedDoc, document, editor, persist, locked]);

  const renameDocument = useCallback(
    (next: string) => {
      setName(next);
      if (!editor) {
        return;
      }
      const json = applyTitleToDoc(stampFlowAttrs(editor.getJSON() as EditorDoc), next);
      editor.commands.setContent(json);
      setSerializedDoc(serializeStable(json));
    },
    [editor, stampFlowAttrs],
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

  const handleSaveAsTemplate = useCallback(
    async (templateName: string) => {
      if (!editor || !document) {
        return;
      }
      setSaveAsTemplateBusy(true);
      setSaveAsTemplateError("");
      try {
        await saveQueueRef.current.run(() => persist(editor.getJSON() as EditorDoc, nameRef.current));
        const stamped = stampFlowAttrs(editor.getJSON() as EditorDoc);
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName.trim() || nameRef.current.trim() || "Untitled Template",
            editor_json: stamped,
            tags: ["flow"],
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
          throw new Error(payload.error || payload.message || "Could not save template");
        }
        setSaveAsTemplateOpen(false);
        setStatus("Saved to Library");
        router.push("/app/templates");
      } catch (err) {
        setSaveAsTemplateError(err instanceof Error ? err.message : "Could not save template");
      } finally {
        setSaveAsTemplateBusy(false);
      }
    },
    [document, editor, persist, router, stampFlowAttrs],
  );

  const handleUseTemplate = useCallback(async () => {
    if (!document || !editor) {
      return;
    }
    try {
      await saveQueueRef.current.run(() => persist(editor.getJSON() as EditorDoc, nameRef.current));
      setStatus("Saved");
      if (isTemplate) {
        setUseTemplateOpen(true);
        return;
      }
      openWorkflow({ kind: "document", documentId: document.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("Error");
    }
  }, [document, editor, isTemplate, openWorkflow, persist]);

  const handleSaveDraft = useCallback(async () => {
    if (!editor) {
      return;
    }
    try {
      await saveQueueRef.current.run(() => persist(editor.getJSON() as EditorDoc, nameRef.current));
      setStatus("Saved");
      router.push(isTemplate ? closeHref : "/app/documents?tab=draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("Error");
    }
  }, [closeHref, editor, isTemplate, persist, router]);

  const actionsItems = useMemo<FlowActionsMenuItem[]>(
    () =>
      isTemplate
        ? [
            {
              id: "use-template",
              label: "Use Template",
              description: "Start a new document from this template.",
              onSelect: () => void handleUseTemplate(),
              disabled: locked,
            },
            {
              id: "save-draft",
              label: "Done",
              description: "Save and return to the Library.",
              onSelect: () => void handleSaveDraft(),
              disabled: locked,
            },
          ]
        : [
            {
              id: "save-as-template",
              label: "Save as Template",
              description: "Save a copy to the Library for reuse.",
              onSelect: () => {
                setSaveAsTemplateError("");
                setSaveAsTemplateOpen(true);
              },
              disabled: locked,
            },
            {
              id: "use-template",
              label: "Use Template",
              description: "Add a contact, review, and deliver this document.",
              onSelect: () => void handleUseTemplate(),
              disabled: locked || !document,
            },
            {
              id: "save-draft",
              label: "Save Draft",
              description: "Save to Drafts and pick up where you left off later.",
              onSelect: () => void handleSaveDraft(),
              disabled: locked,
            },
          ],
    [document, handleSaveDraft, handleUseTemplate, isTemplate, locked],
  );

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
    if (!document || isTemplate) {
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
  }, [document, isTemplate]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!locked);
  }, [editor, locked]);

  if (!document && !error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f9fbfd]">
        <p className="text-sm text-[#5f6368]">Loading {isTemplate ? "template" : "document"}…</p>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f9fbfd]">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={closeHref} className="text-sm text-[#1a73e8] underline">
          {isTemplate ? "Back to Library" : "Back to Documents"}
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
        statusLabel={isTemplate ? "Template" : statusLabel(document?.status)}
        locked={locked}
        closeHref={closeHref}
        onSave={() => void saveNow()}
        onPrint={() => window.print()}
        onInsertImage={insertImage}
        onInsertTable={insertTable}
        onInsertPageBreak={insertPageBreak}
        onAddComment={isTemplate ? () => undefined : () => void addComment()}
        zoom={zoom}
        onZoomChange={setZoom}
        showRulers={showRulers}
        onShowRulersChange={setShowRulers}
        actionsItems={actionsItems}
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

      <div className="flow-workspace-main">
        <FlowPageNav
          paperRef={paperStageRef}
          scrollerRef={scrollPaneRef}
          pageCount={pageCount}
          currentPage={currentPage}
          pageWidthPx={FLOW_PAPER_PRESETS[paper].size.pageWidth}
          pageHeightPx={FLOW_PAPER_PRESETS[paper].size.pageHeight}
          zoom={zoom}
          name={name.trim() || "Untitled Document"}
          pageGapPx={32}
        />
        <div className={`flow-workspace${showRulers ? " flow-workspace--rulers" : ""}`}>
          {showRulers ? (
            <FlowMarginRulers
              scrollRef={scrollPaneRef}
              pageWidthPx={FLOW_PAPER_PRESETS[paper].size.pageWidth}
              pageHeightPx={FLOW_PAPER_PRESETS[paper].size.pageHeight}
              pageCount={pageCount}
              zoom={zoom}
              margins={pageMargins}
              locked={locked}
              onChange={handleMarginsChange}
            />
          ) : null}
          <div ref={scrollPaneRef} className="flow-scroll-pane">
            <div
              className="flow-document-paper-frame mx-auto origin-top px-4 py-8"
              style={{
                width: `${Math.round(FLOW_PAPER_PRESETS[paper].size.pageWidth * (zoom / 100) + 32)}px`,
                maxWidth: "100%",
              }}
            >
              <div
                ref={paperStageRef}
                className="flow-paper-stage relative"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top center",
                  width: `${FLOW_PAPER_PRESETS[paper].size.pageWidth}px`,
                  margin: "0 auto",
                  ["--flow-page-gap" as string]: "32px",
                }}
              >
                <FlowPageOverlays
                  editor={editor}
                  pageCount={pageCount}
                  pageHeightPx={FLOW_PAPER_PRESETS[paper].size.pageHeight}
                  pageWidthPx={FLOW_PAPER_PRESETS[paper].size.pageWidth}
                  backgrounds={pageBackgrounds}
                  locked={locked}
                  propertiesPage={propertiesPage}
                  onOpenProperties={openPageProperties}
                  onAddBlankPage={handleAddBlankPage}
                />
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
        </div>
        {activeShelfPanel === "variables" ? (
          <FlowVariablesPanel
            editor={editor}
            variables={variablesContext}
            locked={locked}
            onClose={() => setActiveShelfPanel(null)}
            onChangeVariables={handleVariablesChange}
          />
        ) : null}
        {activeShelfPanel === "page" && propertiesPage != null ? (
          <FlowPagePropertiesPanel
            currentPage={propertiesPage}
            paper={paper}
            backgrounds={pageBackgrounds}
            locked={locked}
            onClose={() => {
              setActiveShelfPanel(null);
              setPropertiesPage(null);
            }}
            onPatch={handleBackgroundPatch}
            onImportBackground={handleImportBackground}
            onDuplicate={handleDuplicatePage}
            onClear={handleClearBackground}
          />
        ) : null}
        <FlowToolShelf
          activePanel={activeShelfPanel}
          variableCount={variableUsageTotal}
          propertiesPage={propertiesPage}
          onSelect={(panel) => setActiveShelfPanel(panel)}
          onCollapse={() => setActiveShelfPanel(null)}
        />
      </div>

      <input
        ref={backgroundFileRef}
        type="file"
        accept={BACKGROUND_IMAGE_EXTENSIONS}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void handleBackgroundFile(file);
        }}
      />

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
      <SaveAsModal
        open={!isTemplate && saveAsTemplateOpen}
        kind="template"
        initialName={name.trim() || "Untitled Template"}
        saving={saveAsTemplateBusy}
        error={saveAsTemplateError}
        hint="Saves a copy to your Library for reuse later."
        onClose={() => {
          if (!saveAsTemplateBusy) {
            setSaveAsTemplateOpen(false);
          }
        }}
        onSave={handleSaveAsTemplate}
      />
      {isTemplate && templateId ? (
        <UseTemplateRecipientModal
          open={useTemplateOpen}
          templateId={templateId}
          templateName={name}
          onClose={() => setUseTemplateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function documentHeadLink(href: string): HTMLLinkElement | null {
  return window.document.head.querySelector(`link[href="${href}"]`);
}
