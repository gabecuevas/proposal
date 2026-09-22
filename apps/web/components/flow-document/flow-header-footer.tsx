"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  applyFlowPageChromeToEditor,
  type FlowChromeRegion,
  type FlowPageChromeState,
} from "@/lib/flow-document/page-chrome";

type Props = {
  editor: Editor | null;
  chrome: FlowPageChromeState;
  onChromeChange: (next: FlowPageChromeState) => void;
  locked?: boolean;
  /** Zoom percent (100 = 1x) — hotspots align to scaled paper. */
  zoom?: number;
};

/**
 * Google Docs–style header/footer hotspots.
 * Hover shows top/bottom zones; double-click opens edit mode with Options menu.
 */
export function FlowHeaderFooterLayer({
  editor,
  chrome,
  onChromeChange,
  locked = false,
  zoom = 100,
}: Props) {
  const [editing, setEditing] = useState<FlowChromeRegion | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [firstDraft, setFirstDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOpenHeader() {
      openRegion("header");
    }
    function onOpenFooter() {
      openRegion("footer");
    }
    window.addEventListener("flow-open-header", onOpenHeader);
    window.addEventListener("flow-open-footer", onOpenFooter);
    return () => {
      window.removeEventListener("flow-open-header", onOpenHeader);
      window.removeEventListener("flow-open-footer", onOpenFooter);
    };
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const root = editor.view.dom;
    function onDblClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest(".rm-page-header, .rm-first-page-header")) {
        event.preventDefault();
        openRegion("header");
      } else if (target.closest(".rm-page-footer")) {
        event.preventDefault();
        openRegion("footer");
      }
    }
    root.addEventListener("dblclick", onDblClick);
    return () => root.removeEventListener("dblclick", onDblClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openRegion closes over latest chrome
  }, [editor, chrome, locked]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        commitAndClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit closes over latest draft
  }, [editing, draft, firstDraft, chrome]);

  function openRegion(region: FlowChromeRegion) {
    if (locked) {
      return;
    }
    const enabledKey = region === "header" ? "headerEnabled" : "footerEnabled";
    const textKey = region === "header" ? "headerText" : "footerText";
    const firstKey = region === "header" ? "firstHeaderText" : "firstFooterText";
    const next: FlowPageChromeState = {
      ...chrome,
      [enabledKey]: true,
    };
    setDraft(String(chrome[textKey] ?? ""));
    setFirstDraft(String(chrome[firstKey] ?? ""));
    setEditing(region);
    setOptionsOpen(false);
    onChromeChange(next);
    if (editor) {
      applyFlowPageChromeToEditor(editor, next);
    }
  }

  function commitAndClose() {
    if (!editing) {
      return;
    }
    const textKey = editing === "header" ? "headerText" : "footerText";
    const firstKey = editing === "header" ? "firstHeaderText" : "firstFooterText";
    const next: FlowPageChromeState = {
      ...chrome,
      [textKey]: draft,
      [firstKey]: firstDraft,
      headerEnabled: editing === "header" ? true : chrome.headerEnabled,
      footerEnabled: editing === "footer" ? true : chrome.footerEnabled,
    };
    // If both drafts empty and removing isn't explicit, keep enabled with empty text
    // so PaginationPlus still reserves the region until user chooses Remove.
    onChromeChange(next);
    if (editor) {
      applyFlowPageChromeToEditor(editor, next);
    }
    setEditing(null);
    setOptionsOpen(false);
  }

  function updateChrome(patch: Partial<FlowPageChromeState>) {
    const next = { ...chrome, ...patch };
    onChromeChange(next);
    if (editor) {
      applyFlowPageChromeToEditor(editor, next);
    }
  }

  function removeRegion() {
    if (!editing) {
      return;
    }
    const next: FlowPageChromeState =
      editing === "header"
        ? {
            ...chrome,
            headerEnabled: false,
            headerText: "",
            firstHeaderText: "",
          }
        : {
            ...chrome,
            footerEnabled: false,
            footerText: "",
            firstFooterText: "",
            showPageNumbers: false,
          };
    onChromeChange(next);
    if (editor) {
      applyFlowPageChromeToEditor(editor, next);
    }
    setEditing(null);
    setOptionsOpen(false);
  }

  function insertPageNumbers() {
    updateChrome({
      showPageNumbers: true,
      footerEnabled: true,
    });
    if (editing !== "footer") {
      setEditing("footer");
      setDraft(chrome.footerText);
      setFirstDraft(chrome.firstFooterText);
    }
    setOptionsOpen(false);
  }

  const label = editing === "header" ? "Header" : "Footer";
  const scale = zoom / 100;

  return (
    <>
      {/* Invisible double-click zones — no hover chrome */}
      {editing !== "header" ? (
        <button
          type="button"
          disabled={locked}
          className="flow-hf-hotspot flow-hf-hotspot--header"
          aria-label="Double-click to edit header"
          tabIndex={-1}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openRegion("header");
          }}
        />
      ) : null}
      {editing !== "footer" ? (
        <button
          type="button"
          disabled={locked}
          className="flow-hf-hotspot flow-hf-hotspot--footer"
          aria-label="Double-click to edit footer"
          tabIndex={-1}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openRegion("footer");
          }}
        />
      ) : null}

      {editing ? (
        <div
          className={cn(
            "flow-hf-editor",
            editing === "header" ? "flow-hf-editor--header" : "flow-hf-editor--footer",
          )}
          style={{ ["--flow-zoom" as string]: String(scale) }}
        >
          <div className="flow-hf-editor-card">
            {editing === "header" ? (
              <>
                <textarea
                  ref={inputRef}
                  value={chrome.differentFirstPage ? firstDraft : draft}
                  onChange={(event) => {
                    if (chrome.differentFirstPage) {
                      setFirstDraft(event.target.value);
                    } else {
                      setDraft(event.target.value);
                    }
                  }}
                  className="flow-hf-textarea"
                  placeholder={chrome.differentFirstPage ? "First page header" : "Header"}
                  rows={2}
                />
                {chrome.differentFirstPage ? (
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="flow-hf-textarea flow-hf-textarea--secondary"
                    placeholder="Header (other pages)"
                    rows={2}
                  />
                ) : null}
              </>
            ) : (
              <>
                <textarea
                  ref={inputRef}
                  value={chrome.differentFirstPage ? firstDraft : draft}
                  onChange={(event) => {
                    if (chrome.differentFirstPage) {
                      setFirstDraft(event.target.value);
                    } else {
                      setDraft(event.target.value);
                    }
                  }}
                  className="flow-hf-textarea"
                  placeholder={chrome.differentFirstPage ? "First page footer" : "Footer"}
                  rows={2}
                />
                {chrome.differentFirstPage ? (
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="flow-hf-textarea flow-hf-textarea--secondary"
                    placeholder="Footer (other pages)"
                    rows={2}
                  />
                ) : null}
                {chrome.showPageNumbers ? (
                  <p className="flow-hf-page-hint">Page numbers appear on the right side of the footer.</p>
                ) : null}
              </>
            )}

            <div ref={barRef} className="flow-hf-bar">
              <span className="flow-hf-bar-label">{label}</span>
              <label className="flow-hf-checkbox">
                <input
                  type="checkbox"
                  checked={chrome.differentFirstPage}
                  onChange={(event) => {
                    const differentFirstPage = event.target.checked;
                    updateChrome({ differentFirstPage });
                    if (differentFirstPage && !firstDraft) {
                      setFirstDraft(draft);
                    }
                  }}
                />
                Different first page
              </label>
              <div className="flow-hf-options-wrap">
                <button
                  type="button"
                  className={cn("flow-hf-options", optionsOpen && "is-open")}
                  onClick={() => setOptionsOpen((value) => !value)}
                >
                  Options
                  <span className="flow-hf-options-caret" aria-hidden>
                    {optionsOpen ? "▴" : "▾"}
                  </span>
                </button>
                {optionsOpen ? (
                  <div className="flow-hf-options-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        window.dispatchEvent(new Event("flow-open-headers-footers-modal"));
                        setOptionsOpen(false);
                      }}
                    >
                      {label} format
                    </button>
                    <button type="button" role="menuitem" onClick={insertPageNumbers}>
                      Page numbers
                    </button>
                    <button type="button" role="menuitem" onClick={removeRegion}>
                      Remove {label.toLowerCase()}
                    </button>
                  </div>
                ) : null}
              </div>
              <button type="button" className="flow-hf-done" onClick={commitAndClose}>
                Done
              </button>
            </div>
          </div>

          {/* Click-catcher to leave edit mode when clicking the page body */}
          <button
            type="button"
            className="flow-hf-dismiss"
            aria-label={`Finish editing ${label.toLowerCase()}`}
            onClick={commitAndClose}
          />
        </div>
      ) : null}
    </>
  );
}
