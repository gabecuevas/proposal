"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useDocumentPricing } from "@/components/editor/pricing-context";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import { contentOffsetFromVisual } from "@/lib/editor/page-flow";
import {
  childIndexesNeedingBreakBefore,
  pageSeamMetricsFromStyles,
  printableContentHeight,
  seamSpacerHeight,
  spacerHeightAbove,
} from "@/lib/editor/page-seam";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

function money(value: number, currency: string): string {
  return `${currency.toUpperCase()} ${value.toFixed(2)}`;
}

function sameKeys(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every((key) => a[key] === b[key]);
}

export function QuoteTableView({ node }: NodeViewProps) {
  const pricing = useDocumentPricing();
  const tableId = String(node.attrs.tableId ?? "default");
  const totals = calculateQuoteTotals(pricing);
  const currency = pricing.currency || "USD";
  const rootRef = useRef<HTMLElement>(null);
  const [gapsBefore, setGapsBefore] = useState<Record<string, boolean>>({});
  const [spacerPx, setSpacerPx] = useState(128);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const editor = root?.closest(".tiptap-creator") as HTMLElement | null;
    if (!root || !editor) {
      return;
    }
    const metrics = pageSeamMetricsFromStyles(root);
    setSpacerPx(seamSpacerHeight(metrics));
    const paddingTop = Number.parseFloat(getComputedStyle(editor).paddingTop) || metrics.margin;
    const editorTop = editor.getBoundingClientRect().top;
    const rows = [...root.querySelectorAll<HTMLElement>("[data-quote-row]")];
    const lines = rows.map((row) => {
      const rect = row.getBoundingClientRect();
      const visualTop = rect.top - editorTop;
      const visualBottom = rect.bottom - editorTop;
      const spacers = spacerHeightAbove(editor, visualTop);
      return {
        id: row.getAttribute("data-quote-row") ?? "",
        contentTop: contentOffsetFromVisual(visualTop, paddingTop, spacers),
        contentBottom: contentOffsetFromVisual(visualBottom, paddingTop, spacers),
      };
    });
    const breakAt = new Set(
      childIndexesNeedingBreakBefore(lines, printableContentHeight(metrics)),
    );
    const next: Record<string, boolean> = {};
    lines.forEach((line, index) => {
      if (breakAt.has(index) && line.id) {
        next[line.id] = true;
      }
    });
    setGapsBefore((prev) => (sameKeys(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    measure();
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    observer.observe(root);
    const paper = root.closest("[data-creator-paper]");
    if (paper instanceof Element) {
      observer.observe(paper);
    }
    return () => observer.disconnect();
  }, [measure, pricing.items, pricing.currency, pricing.discountPercent, pricing.taxPercent]);

  const items = pricing.items;
  const gap = (id: string) =>
    gapsBefore[id] ? (
      <tr data-creator-flow-break="true" aria-hidden>
        <td colSpan={6} style={{ height: spacerPx, padding: 0, border: 0 }} />
      </tr>
    ) : null;

  return (
    <NodeViewWrapper
      as="section"
      className="quote-table overflow-visible rounded border border-border bg-surface p-3"
      data-quote-table-id={tableId}
      data-node-type="quoteTable"
      ref={rootRef}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">No line items yet. Edit pricing in the sidebar.</p>
      ) : (
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            {gap("__head")}
            <tr className="border-b border-border text-muted" data-quote-row="__head">
              <th className="py-1 pr-2 font-medium">Item</th>
              <th className="py-1 pr-2 font-medium">Qty</th>
              <th className="py-1 pr-2 font-medium">Unit Price</th>
              <th className="py-1 pr-2 font-medium">Cadence</th>
              <th className="py-1 pr-2 font-medium">Status</th>
              <th className="py-1 font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const selected = item.optional ? item.selected === true : true;
              const lineTotal = selected ? item.quantity * item.unitPrice : 0;
              return (
                <SeamRow key={item.id} gap={gap(item.id)}>
                  <tr className="border-b border-border/70" data-quote-row={item.id}>
                    <td className="py-1 pr-2">{item.name}</td>
                    <td className="py-1 pr-2">{item.quantity}</td>
                    <td className="py-1 pr-2">{money(item.unitPrice, currency)}</td>
                    <td className="py-1 pr-2">
                      {item.recurring?.interval ? `Recurring ${item.recurring.interval}` : "One-time"}
                    </td>
                    <td className="py-1 pr-2">{selected ? "Included" : "Optional (not selected)"}</td>
                    <td className="py-1">{money(lineTotal, currency)}</td>
                  </tr>
                </SeamRow>
              );
            })}
          </tbody>
        </table>
      )}
      {gapsBefore.totals ? (
        <div data-creator-flow-break="true" aria-hidden style={{ height: spacerPx }} />
      ) : null}
      <div data-quote-row="totals">
        <p className="mt-2 text-xs">One-time subtotal: {money(totals.oneTimeSubtotal, currency)}</p>
        <p className="text-xs">Discount: {money(totals.discountAmount, currency)}</p>
        <p className="text-xs">Tax: {money(totals.taxAmount, currency)}</p>
        <p className="text-xs font-medium">Total due now: {money(totals.totalDueNow, currency)}</p>
      </div>
    </NodeViewWrapper>
  );
}

function SeamRow({ gap, children }: { gap: ReactNode; children: ReactNode }) {
  return (
    <>
      {gap}
      {children}
    </>
  );
}
