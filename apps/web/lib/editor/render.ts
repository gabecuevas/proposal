import type { EditorDoc, EditorNode, JSONValue, PricingModel, SignerFieldValue } from "./types";
import { calculateQuoteTotals } from "./quote";
import { renderVariableText } from "./variables";

type RenderMode = "sender-preview" | "recipient-fill" | "finalized";

type RenderInput = {
  doc: EditorDoc;
  mode: RenderMode;
  resolvedVariables: Record<string, JSONValue>;
  pricing?: PricingModel;
  signerFieldValues: SignerFieldValue[];
  activeRecipientId?: string;
  certificate?: {
    docHash: string;
    finalizedAt: string;
    actorUserId?: string;
    actorRecipientId?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    pdfKey?: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value: number, currency: string): string {
  return `${currency.toUpperCase()} ${value.toFixed(2)}`;
}

function renderNode(node: EditorNode, input: RenderInput): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</p>`;
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      return `<${tag}>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</${tag}>`;
    }
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</blockquote>`;
    case "bulletList":
      return `<ul>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</ol>`;
    case "listItem":
      return `<li>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</li>`;
    case "text":
      return escapeHtml(node.text ?? "");
    case "image": {
      const src = String(node.attrs?.src ?? "");
      const alt = escapeHtml(String(node.attrs?.alt ?? ""));
      return `<img src="${escapeHtml(src)}" alt="${alt}" />`;
    }
    case "pageBreak":
      return '<div class="page-break" data-node-type="pageBreak"></div>';
    case "variableToken": {
      const key = String(node.attrs?.key ?? "");
      const fallback = node.attrs?.fallback ? String(node.attrs.fallback) : undefined;
      const text = renderVariableText(key, input.resolvedVariables, fallback);
      return `<span class="variable-token" data-variable-key="${escapeHtml(key)}">${escapeHtml(text)}</span>`;
    }
    case "contentBlockEmbed": {
      const blockId = String(node.attrs?.blockId ?? "");
      const version = String(node.attrs?.version ?? "1");
      return `<div class="content-block-embed" data-block-id="${escapeHtml(blockId)}" data-block-version="${escapeHtml(version)}"></div>`;
    }
    case "quoteTable": {
      if (!input.pricing) {
        return '<div class="quote-table-empty" data-node-type="quoteTable"></div>';
      }
      const totals = calculateQuoteTotals(input.pricing);
      const currency = String(input.pricing.currency || "USD");
      const lineRows = input.pricing.items
        .map((item) => {
          const quantity = Number(item.quantity ?? 0);
          const unitPrice = Number(item.unitPrice ?? 0);
          const selected = item.optional ? item.selected === true : true;
          const lineTotal = selected ? quantity * unitPrice : 0;
          const cadence = item.recurring?.interval ? `Recurring ${item.recurring.interval}` : "One-time";
          return `<tr><td>${escapeHtml(item.name)}</td><td>${quantity}</td><td>${formatMoney(unitPrice, currency)}</td><td>${escapeHtml(
            cadence,
          )}</td><td>${selected ? "Included" : "Optional (not selected)"}</td><td>${formatMoney(lineTotal, currency)}</td></tr>`;
        })
        .join("");
      return `<section class="quote-table" data-node-type="quoteTable"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Cadence</th><th>Status</th><th>Line Total</th></tr></thead><tbody>${lineRows}</tbody></table><p>One-time subtotal: ${formatMoney(
        totals.oneTimeSubtotal,
        currency,
      )}</p><p>Recurring monthly subtotal: ${formatMoney(totals.recurringMonthlySubtotal, currency)}</p><p>Recurring yearly subtotal: ${formatMoney(
        totals.recurringYearlySubtotal,
        currency,
      )}</p><p>Discount: ${formatMoney(totals.discountAmount, currency)}</p><p>Tax: ${formatMoney(
        totals.taxAmount,
        currency,
      )}</p><p>Total due now: ${formatMoney(totals.totalDueNow, currency)}</p></section>`;
    }
    case "signerField": {
      const fieldId = String(node.attrs?.fieldId ?? "");
      const recipientId = String(node.attrs?.recipientId ?? "");
      const type = String(node.attrs?.type ?? "text");
      const value = input.signerFieldValues.find((field) => field.fieldId === fieldId);
      const canEdit = input.mode === "recipient-fill" && input.activeRecipientId === recipientId;
      const displayValue = value ? escapeHtml(String(value.value)) : "";

      if (input.mode === "finalized") {
        return `<span class="signer-field-finalized" data-field-id="${escapeHtml(fieldId)}">${displayValue}</span>`;
      }

      return `<span class="signer-field" data-field-id="${escapeHtml(fieldId)}" data-recipient-id="${escapeHtml(recipientId)}" data-type="${escapeHtml(type)}" data-editable="${String(
        canEdit,
      )}">${displayValue || `[${type}]`}</span>`;
    }
    default:
      return (node.content ?? []).map((child) => renderNode(child, input)).join("");
  }
}

export function renderComputedHtml(input: RenderInput): string {
  const body = input.doc.content.map((node) => renderNode(node, input)).join("");
  if (input.mode !== "finalized") {
    return `<article>${body}</article>`;
  }
  const certificate = input.certificate;
  const certificateBody = certificate
    ? [
        `<p>Document hash: ${escapeHtml(certificate.docHash)}</p>`,
        `<p>Finalized at: ${escapeHtml(certificate.finalizedAt)}</p>`,
        `<p>Actor user: ${escapeHtml(certificate.actorUserId ?? "n/a")}</p>`,
        `<p>Actor recipient: ${escapeHtml(certificate.actorRecipientId ?? "n/a")}</p>`,
        `<p>IP address: ${escapeHtml(certificate.ipAddress ?? "n/a")}</p>`,
        `<p>User agent: ${escapeHtml(certificate.userAgent ?? "n/a")}</p>`,
        `<p>Artifact key: ${escapeHtml(certificate.pdfKey ?? "pending")}</p>`,
      ].join("")
    : "<p>Document finalized with immutable audit trail.</p>";
  return `<article>${body}</article><section class="certificate-page"><h2>Certificate</h2>${certificateBody}</section>`;
}
