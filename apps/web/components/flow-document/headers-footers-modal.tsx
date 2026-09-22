"use client";

import { useEffect, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  DEFAULT_FLOW_PAGE_CHROME,
  type FlowPageChromeState,
} from "@/lib/flow-document/page-chrome";

type Props = {
  open: boolean;
  chrome: FlowPageChromeState;
  onClose: () => void;
  onApply: (next: FlowPageChromeState) => void;
};

/**
 * Google Docs–style Headers & footers settings modal (Format menu).
 */
export function HeadersFootersModal({ open, chrome, onClose, onApply }: Props) {
  const [headerMargin, setHeaderMargin] = useState(String(chrome.headerMarginInches));
  const [footerMargin, setFooterMargin] = useState(String(chrome.footerMarginInches));
  const [differentFirstPage, setDifferentFirstPage] = useState(chrome.differentFirstPage);
  const [differentOddEven, setDifferentOddEven] = useState(chrome.differentOddEven);

  useEffect(() => {
    if (!open) {
      return;
    }
    setHeaderMargin(String(chrome.headerMarginInches));
    setFooterMargin(String(chrome.footerMarginInches));
    setDifferentFirstPage(chrome.differentFirstPage);
    setDifferentOddEven(chrome.differentOddEven);
  }, [open, chrome]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  function apply() {
    const headerMarginInches = clampInches(headerMargin, DEFAULT_FLOW_PAGE_CHROME.headerMarginInches);
    const footerMarginInches = clampInches(footerMargin, DEFAULT_FLOW_PAGE_CHROME.footerMarginInches);
    onApply({
      ...chrome,
      headerMarginInches,
      footerMarginInches,
      differentFirstPage,
      differentOddEven,
    });
    onClose();
  }

  return (
    <div className="flow-hf-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-hf-modal-title"
        className="flow-hf-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="flow-hf-modal-title" className="flow-hf-modal-title">
          Headers &amp; footers
        </h2>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Margins</h3>
          <label className="flow-hf-modal-field">
            <span>Header (inches from top)</span>
            <input
              type="text"
              inputMode="decimal"
              value={headerMargin}
              onChange={(event) => setHeaderMargin(event.target.value)}
              className="flow-hf-modal-input"
            />
          </label>
          <label className="flow-hf-modal-field">
            <span>Footer (inches from bottom)</span>
            <input
              type="text"
              inputMode="decimal"
              value={footerMargin}
              onChange={(event) => setFooterMargin(event.target.value)}
              className="flow-hf-modal-input"
            />
          </label>
        </section>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Layout</h3>
          <label className="flow-hf-modal-check">
            <input
              type="checkbox"
              checked={differentFirstPage}
              onChange={(event) => setDifferentFirstPage(event.target.checked)}
            />
            Different first page
          </label>
          <label className="flow-hf-modal-check">
            <input
              type="checkbox"
              checked={differentOddEven}
              onChange={(event) => setDifferentOddEven(event.target.checked)}
            />
            Different odd &amp; even
          </label>
        </section>

        <div className="flow-hf-modal-actions">
          <button type="button" className="flow-hf-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={cn("flow-hf-modal-apply")} onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function clampInches(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.min(3, Math.round(n * 100) / 100);
}
