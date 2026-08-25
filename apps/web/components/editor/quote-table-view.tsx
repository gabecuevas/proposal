"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useDocumentPricing } from "@/components/editor/pricing-context";
import { calculateQuoteTotals } from "@/lib/editor/quote";

function money(value: number, currency: string): string {
  return `${currency.toUpperCase()} ${value.toFixed(2)}`;
}

export function QuoteTableView({ node }: NodeViewProps) {
  const pricing = useDocumentPricing();
  const tableId = String(node.attrs.tableId ?? "default");
  const totals = calculateQuoteTotals(pricing);
  const currency = pricing.currency || "USD";

  return (
    <NodeViewWrapper
      as="section"
      className="quote-table overflow-hidden rounded border border-border bg-surface p-3"
      data-quote-table-id={tableId}
      data-node-type="quoteTable"
    >
      {pricing.items.length === 0 ? (
        <p className="text-sm text-muted">No line items yet. Edit pricing in the sidebar.</p>
      ) : (
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-1 pr-2 font-medium">Item</th>
              <th className="py-1 pr-2 font-medium">Qty</th>
              <th className="py-1 pr-2 font-medium">Unit Price</th>
              <th className="py-1 pr-2 font-medium">Cadence</th>
              <th className="py-1 pr-2 font-medium">Status</th>
              <th className="py-1 font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {pricing.items.map((item) => {
              const selected = item.optional ? item.selected === true : true;
              const lineTotal = selected ? item.quantity * item.unitPrice : 0;
              return (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-1 pr-2">{item.name}</td>
                  <td className="py-1 pr-2">{item.quantity}</td>
                  <td className="py-1 pr-2">{money(item.unitPrice, currency)}</td>
                  <td className="py-1 pr-2">
                    {item.recurring?.interval ? `Recurring ${item.recurring.interval}` : "One-time"}
                  </td>
                  <td className="py-1 pr-2">{selected ? "Included" : "Optional (not selected)"}</td>
                  <td className="py-1">{money(lineTotal, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs">One-time subtotal: {money(totals.oneTimeSubtotal, currency)}</p>
      <p className="text-xs">Discount: {money(totals.discountAmount, currency)}</p>
      <p className="text-xs">Tax: {money(totals.taxAmount, currency)}</p>
      <p className="text-xs font-medium">Total due now: {money(totals.totalDueNow, currency)}</p>
    </NodeViewWrapper>
  );
}
