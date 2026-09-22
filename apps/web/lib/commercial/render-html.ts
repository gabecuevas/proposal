import {
  calculateCommercialTotals,
  formatMoneyMinor,
  lineAmountMinor,
  quantityToDisplay,
} from "./calculate";
import type { CommercialDocument } from "./schema";
import { currencyPrecision } from "./schema";
import { resolveCommercialText } from "./variables";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function multilineHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

export function renderCommercialDocumentHtml(input: {
  commercial: CommercialDocument;
  context?: Record<string, unknown>;
  /** When true, hide empty optional sections and omit edit-only chrome. */
  finalized?: boolean;
  amountPaidMinorOverride?: number;
}): string {
  const { commercial } = input;
  const context = input.context ?? {};
  const sender = resolveCommercialText(commercial.sender.text, context, {
    keepUnresolved: !input.finalized,
  }).text;
  const billTo = resolveCommercialText(commercial.billTo.text, context, {
    keepUnresolved: !input.finalized,
  }).text;
  const shipTo = resolveCommercialText(commercial.shipTo.text, context, {
    keepUnresolved: !input.finalized,
  }).text;
  const notes = resolveCommercialText(commercial.notes, context, {
    keepUnresolved: !input.finalized,
  }).text;
  const terms = resolveCommercialText(commercial.terms, context, {
    keepUnresolved: !input.finalized,
  }).text;

  const totals = calculateCommercialTotals({
    document: commercial,
    amountPaidMinorOverride: input.amountPaidMinorOverride,
  });
  const precision = currencyPrecision(commercial.currency);
  const money = (minor: number) => formatMoneyMinor(minor, commercial.currency, commercial.locale);
  const labels = commercial.labels;
  const isInvoice = commercial.type === "invoice";

  const logo = commercial.logoAssetKey
    ? `<img class="cm-logo" src="/api/uploads/${escapeHtml(commercial.logoAssetKey)}" alt="" />`
    : "";

  const metaRows = [
    [labels.date, commercial.issueDate ?? ""],
    [labels.paymentTerms, commercial.paymentTerms],
    ...(isInvoice ? [[labels.dueDate, commercial.dueDate ?? ""]] : []),
    [labels.poNumber, commercial.poNumber],
  ]
    .filter(([, value]) => !input.finalized || Boolean(value))
    .map(
      ([label, value]) =>
        `<div class="cm-meta-row"><span>${escapeHtml(label!)}</span><span>${escapeHtml(value!)}</span></div>`,
    )
    .join("");

  const lines = commercial.lineItems
    .filter((item) => !input.finalized || item.description.trim() || item.rateMinor || item.quantityScaled !== 10_000)
    .map((item) => {
      const amount = lineAmountMinor(item, precision);
      return `<tr>
        <td>${multilineHtml(item.description)}</td>
        <td class="num">${escapeHtml(quantityToDisplay(item.quantityScaled))}</td>
        <td class="num">${escapeHtml(money(item.rateMinor))}</td>
        <td class="num">${escapeHtml(money(amount))}</td>
      </tr>`;
    })
    .join("");

  const discountRow =
    commercial.discount.enabled && (!input.finalized || totals.discountMinor > 0)
      ? `<div class="cm-total-row"><span>${escapeHtml(labels.discount)}</span><span>-${escapeHtml(money(totals.discountMinor))}</span></div>`
      : "";
  const shippingRow =
    commercial.shipping.enabled && (!input.finalized || totals.shippingMinor > 0)
      ? `<div class="cm-total-row"><span>${escapeHtml(labels.shipping)}</span><span>${escapeHtml(money(totals.shippingMinor))}</span></div>`
      : "";
  const taxRow =
    commercial.tax.enabled || !input.finalized
      ? `<div class="cm-total-row"><span>${escapeHtml(labels.tax)}</span><span>${escapeHtml(money(totals.taxMinor))}</span></div>`
      : "";

  const invoicePayments = isInvoice
    ? `<div class="cm-total-row"><span>${escapeHtml(labels.amountPaid)}</span><span>${escapeHtml(money(totals.amountPaidMinor))}</span></div>
       <div class="cm-total-row cm-balance"><span>${escapeHtml(labels.balanceDue)}</span><span>${escapeHtml(money(totals.balanceDueMinor))}</span></div>`
    : "";

  const shipBlock =
    !input.finalized || shipTo.trim()
      ? `<div class="cm-party"><div class="cm-party-label">${escapeHtml(labels.shipTo)}</div><div>${multilineHtml(shipTo || "")}</div></div>`
      : "";

  const notesBlock =
    !input.finalized || notes.trim()
      ? `<div class="cm-notes"><div class="cm-party-label">${escapeHtml(labels.notes)}</div><div>${multilineHtml(notes)}</div></div>`
      : "";
  const termsBlock =
    !input.finalized || terms.trim()
      ? `<div class="cm-notes"><div class="cm-party-label">${escapeHtml(labels.terms)}</div><div>${multilineHtml(terms)}</div></div>`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
@page { size: Letter; margin: 0.5in; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f2744; }
.cm-paper { max-width: 800px; margin: 0 auto; }
.cm-logo { max-width: 180px; max-height: 116px; width: auto; height: auto; object-fit: contain; display: block; margin-bottom: 12px; }
.cm-header { display: flex; justify-content: space-between; gap: 24px; }
.cm-title { font-size: 42px; font-weight: 700; letter-spacing: 0.02em; margin: 0; color: #0f2744; }
.cm-number { margin-top: 8px; font-size: 14px; }
.cm-meta-row { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; margin-top: 6px; min-width: 220px; }
.cm-sender { margin-top: 12px; white-space: pre-wrap; font-size: 13px; line-height: 1.45; }
.cm-parties { display: flex; gap: 16px; margin-top: 20px; }
.cm-party { flex: 1; font-size: 13px; line-height: 1.45; }
.cm-party-label { font-weight: 700; margin-bottom: 4px; }
table.cm-items { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
table.cm-items thead th { background: #0f2744; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; }
table.cm-items thead th.num, table.cm-items td.num { text-align: right; white-space: nowrap; }
table.cm-items tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.cm-bottom { display: flex; gap: 24px; margin-top: 20px; }
.cm-bottom-left { flex: 1; }
.cm-bottom-right { width: 240px; font-size: 13px; }
.cm-total-row { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; }
.cm-total-row.cm-grand, .cm-total-row.cm-balance { font-weight: 700; font-size: 15px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #cbd5e1; }
.cm-notes { margin-bottom: 14px; font-size: 13px; line-height: 1.45; }
</style></head><body>
<article class="cm-paper">
  <div class="cm-header">
    <div>
      ${logo}
      <div class="cm-sender">${multilineHtml(sender)}</div>
    </div>
    <div>
      <h1 class="cm-title">${escapeHtml(labels.title || (isInvoice ? "INVOICE" : "QUOTE"))}</h1>
      <div class="cm-number"># ${escapeHtml(commercial.documentNumber)}</div>
      <div style="margin-top:12px">${metaRows}</div>
    </div>
  </div>
  <div class="cm-parties">
    <div class="cm-party"><div class="cm-party-label">${escapeHtml(labels.billTo)}</div><div>${multilineHtml(billTo)}</div></div>
    ${shipBlock}
  </div>
  <table class="cm-items">
    <thead>
      <tr>
        <th>${escapeHtml(labels.item)}</th>
        <th class="num">${escapeHtml(labels.quantity)}</th>
        <th class="num">${escapeHtml(labels.rate)}</th>
        <th class="num">${escapeHtml(labels.amount)}</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>
  <div class="cm-bottom">
    <div class="cm-bottom-left">${notesBlock}${termsBlock}</div>
    <div class="cm-bottom-right">
      <div class="cm-total-row"><span>${escapeHtml(labels.subtotal)}</span><span>${escapeHtml(money(totals.subtotalMinor))}</span></div>
      ${discountRow}
      ${taxRow}
      ${shippingRow}
      <div class="cm-total-row cm-grand"><span>${escapeHtml(labels.total)}</span><span>${escapeHtml(money(totals.totalMinor))}</span></div>
      ${invoicePayments}
    </div>
  </div>
</article>
</body></html>`;
}
