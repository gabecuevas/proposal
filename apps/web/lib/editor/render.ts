import type { EditorDoc, EditorNode, JSONValue, PricingModel, SignerFieldValue } from "./types";
import { assetUrl } from "@/lib/storage/asset-url";
import { fieldCanvasAspectRatio } from "./extensions/field-canvas";
import { clampImageWidth, parseImageAlign } from "./extensions/resizable-image";
import { collectHeadings } from "./extensions/table-of-contents";
import { migrateSignerFieldsDoc } from "./migrate-signer-fields";
import { renderPageBackgroundsHtml } from "./page-backgrounds";
import { calculateQuoteTotals } from "./quote";
import { parseSignerFieldAttrs } from "./signer-field-attrs";
import { renderVariableText } from "./variables";

type RenderMode = "sender-preview" | "recipient-fill" | "finalized";

type RenderInput = {
  doc: EditorDoc;
  mode: RenderMode;
  resolvedVariables: Record<string, JSONValue>;
  pricing?: PricingModel;
  signerFieldValues: SignerFieldValue[];
  activeRecipientId?: string;
  /** Absolute origin for uploaded assets; required when rendering outside a browser session. */
  assetBaseUrl?: string;
  /** Grants the detached PDF renderer read access to workspace assets. */
  assetToken?: string;
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

function renderTextWithMarks(node: EditorNode): string {
  let html = escapeHtml(node.text ?? "");
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") {
      html = `<strong>${html}</strong>`;
    } else if (mark.type === "italic") {
      html = `<em>${html}</em>`;
    } else if (mark.type === "underline") {
      html = `<u>${html}</u>`;
    } else if (mark.type === "strike") {
      html = `<s>${html}</s>`;
    } else if (mark.type === "link") {
      const href = escapeHtml(String(mark.attrs?.href ?? ""));
      html = `<a href="${href}">${html}</a>`;
    } else if (mark.type === "highlight") {
      const color = escapeHtml(String(mark.attrs?.color ?? "#fef08a"));
      html = `<mark style="background-color:${color}">${html}</mark>`;
    } else if (mark.type === "textStyle") {
      const styles: string[] = [];
      if (mark.attrs?.color) {
        styles.push(`color:${escapeHtml(String(mark.attrs.color))}`);
      }
      if (mark.attrs?.fontSize) {
        styles.push(`font-size:${escapeHtml(String(mark.attrs.fontSize))}`);
      }
      if (mark.attrs?.fontFamily) {
        styles.push(`font-family:${escapeHtml(String(mark.attrs.fontFamily))}`);
      }
      if (styles.length) {
        html = `<span style="${styles.join(";")}">${html}</span>`;
      }
    }
  }
  return html;
}

function formatMoney(value: number, currency: string): string {
  return `${currency.toUpperCase()} ${value.toFixed(2)}`;
}

function parseDropdownOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function resolveFieldValue(
  fieldId: string,
  attrs: ReturnType<typeof parseSignerFieldAttrs>,
  input: RenderInput,
): JSONValue | undefined {
  const stored = input.signerFieldValues.find((field) => field.fieldId === fieldId);
  if (stored && stored.value !== null && stored.value !== undefined) {
    if (typeof stored.value === "string" && stored.value.trim() === "") {
      // treat empty string as unset so defaults can apply (except text fields can be intentionally empty)
      if (attrs.type === "text") {
        return stored.value as JSONValue;
      }
    } else {
      return stored.value as JSONValue;
    }
  }
  const dv = attrs.defaultValue?.trim();
  if (!dv) {
    return undefined;
  }
  if (attrs.type === "checkbox") {
    return dv === "true" || dv === "1";
  }
  return dv;
}

function renderSignerFieldNode(node: EditorNode, input: RenderInput): string {
  const attrs = parseSignerFieldAttrs(node.attrs as Record<string, unknown>, 0);
  const fieldId = attrs.fieldId;
  const recipientId = attrs.recipientId;
  const type = attrs.type;
  const value = resolveFieldValue(fieldId, attrs, input);
  const canEdit = input.mode === "recipient-fill" && input.activeRecipientId === recipientId;
  const label = escapeHtml(attrs.label.trim() || type);
  const placeholder = escapeHtml(attrs.placeholder);
  const left = attrs.xPct * 100;
  const top = attrs.yPct * 100;
  const width = attrs.wPct * 100;
  const height = attrs.hPct * 100;

  const baseDataAttrs = `data-field-id="${escapeHtml(fieldId)}" data-recipient-id="${escapeHtml(recipientId)}" data-type="${escapeHtml(type)}" data-required="${String(attrs.required)}"`;

  // Rendered output always lands on paper, so it stays light regardless of theme.
  const shellClass = `rendered-signer-field absolute flex flex-col overflow-hidden rounded border border-slate-300 bg-white/95 p-1.5 text-[11px] shadow-sm`;
  const layoutStyle = `--field-x:${attrs.xPct};--field-y:${attrs.yPct};--field-w:${attrs.wPct};--field-h:${attrs.hPct};--field-page:${attrs.page};left:${left}%;top:${top}%;width:${width}%;height:${height}%;min-height:36px`;

  if (input.mode === "finalized") {
    let display = "";
    if (value !== undefined && value !== null) {
      if (typeof value === "boolean") {
        display = value ? "Yes" : "No";
      } else {
        display = String(value);
      }
    }
    return `<div class="${shellClass} signer-field--finalized" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="finalized"><span class="font-medium text-slate-900">${label}</span><span class="mt-0.5 text-slate-700">${escapeHtml(display)}</span></div>`;
  }

  if (input.mode === "sender-preview") {
    const hint = attrs.required ? "Required" : "Optional";
    return `<div class="${shellClass} signer-field--sender-preview" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="sender-preview" data-editable="false"><span class="font-medium text-slate-800">${label}</span><span class="mt-0.5 text-slate-500">${hint}</span><span class="mt-auto truncate text-[10px] text-slate-400">${escapeHtml(type)}</span></div>`;
  }

  // recipient-fill
  if (!canEdit) {
    return `<div class="${shellClass} signer-field--other-recipient" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="recipient-fill" data-editable="false"><span class="font-medium text-slate-600">${label}</span><span class="mt-0.5 text-slate-400">Assigned to another recipient</span></div>`;
  }

  if (type === "checkbox") {
    const checked = value === true || value === "true" || value === 1;
    return `<div class="${shellClass} signer-field--fill" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="recipient-fill" data-editable="true"><label class="flex cursor-pointer items-center gap-2 text-slate-800"><input type="checkbox" ${checked ? "checked" : ""} data-field-id="${escapeHtml(fieldId)}" />${label}</label></div>`;
  }

  if (type === "dropdown") {
    const options = parseDropdownOptions(attrs.dropdownOptions);
    const current = value !== undefined && value !== null ? String(value) : "";
    const opts = options
      .map((opt) => `<option value="${escapeHtml(opt)}" ${opt === current ? "selected" : ""}>${escapeHtml(opt)}</option>`)
      .join("");
    return `<div class="${shellClass} signer-field--fill" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="recipient-fill" data-editable="true"><label class="block font-medium text-slate-800">${label}<select class="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" data-field-id="${escapeHtml(fieldId)}">${opts || `<option value="">Select…</option>`}</select></label></div>`;
  }

  if (type === "date") {
    const v = value !== undefined && value !== null ? String(value) : "";
    return `<div class="${shellClass} signer-field--fill" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="recipient-fill" data-editable="true"><label class="block font-medium text-slate-800">${label}<input type="date" class="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" data-field-id="${escapeHtml(fieldId)}" value="${escapeHtml(v)}" placeholder="${placeholder}" /></label></div>`;
  }

  if (type === "signature" || type === "initial") {
    const v = value !== undefined && value !== null ? String(value) : "";
    return `<div class="${shellClass} signer-field--fill" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="recipient-fill" data-editable="true"><span class="font-medium text-slate-800">${label}</span><input type="text" class="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" data-field-id="${escapeHtml(fieldId)}" value="${escapeHtml(v)}" placeholder="${placeholder || (type === "signature" ? "Type full name to sign" : "Initials")}" autocomplete="off" /></div>`;
  }

  const v = value !== undefined && value !== null ? String(value) : "";
  return `<div class="${shellClass} signer-field--fill" style="${layoutStyle}" ${baseDataAttrs} data-field-mode="recipient-fill" data-editable="true"><label class="block font-medium text-slate-800">${label}<input type="text" class="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" data-field-id="${escapeHtml(fieldId)}" value="${escapeHtml(v)}" placeholder="${placeholder}" /></label></div>`;
}

function blockInlineStyle(node: EditorNode): string {
  const styles: string[] = [];
  const align = node.attrs?.textAlign;
  if (typeof align === "string" && align && align !== "left") {
    styles.push(`text-align:${escapeHtml(align)}`);
  }
  const lineHeight = node.attrs?.lineHeight;
  if (typeof lineHeight === "string" && lineHeight) {
    styles.push(`line-height:${escapeHtml(lineHeight)}`);
  }
  const indent = Number(node.attrs?.indent ?? 0);
  if (Number.isFinite(indent) && indent > 0) {
    styles.push(`padding-left:${indent * 24}px`);
  }
  return styles.length ? ` style="${styles.join(";")}"` : "";
}

function renderNode(node: EditorNode, input: RenderInput): string {
  switch (node.type) {
    case "paragraph":
      return `<p${blockInlineStyle(node)}>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</p>`;
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      return `<${tag}${blockInlineStyle(node)}>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</${tag}>`;
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
      return renderTextWithMarks(node);
    case "hardBreak":
      return "<br />";
    case "horizontalRule":
      return "<hr />";
    case "image": {
      const assetKey = String(node.attrs?.assetKey ?? "");
      const src = assetKey
        ? assetUrl(assetKey, { baseUrl: input.assetBaseUrl, token: input.assetToken })
        : String(node.attrs?.src ?? "");
      const alt = escapeHtml(String(node.attrs?.alt ?? ""));
      const widthPct = clampImageWidth(node.attrs?.widthPct);
      const align = parseImageAlign(node.attrs?.align);
      return `<div class="creator-image-block" data-align="${align}" style="display:flex;justify-content:${align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"}"><img src="${escapeHtml(src)}" alt="${alt}" style="width:${widthPct}%;height:auto;" /></div>`;
    }
    case "youtube": {
      const src = escapeHtml(String(node.attrs?.src ?? ""));
      return `<figure class="creator-video" data-youtube-video><a href="${src}">Watch video: ${src}</a></figure>`;
    }
    case "textBox":
      return `<div class="creator-text-box" data-node-type="textBox">${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</div>`;
    case "table":
      return `<table>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</table>`;
    case "tableRow":
      return `<tr>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</tr>`;
    case "tableHeader":
      return `<th>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</th>`;
    case "tableCell":
      return `<td>${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</td>`;
    case "tableOfContents": {
      const entries = collectHeadings(input.doc, Number(node.attrs?.maxLevel ?? 3));
      const items = entries
        .map(
          (entry) =>
            `<li class="toc-level-${entry.level}"><a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.text)}</a></li>`,
        )
        .join("");
      return `<nav class="creator-toc" data-node-type="tableOfContents"><p>${escapeHtml(String(node.attrs?.title ?? "Table of contents"))}</p><ol>${items}</ol></nav>`;
    }
    case "pageBreak":
      return '<div class="page-break" data-node-type="pageBreak"></div>';
    case "fieldOverlay":
      return `<div class="rendered-field-overlay" data-node-type="fieldOverlay">${(node.content ?? []).map((child) => renderNode(child, input)).join("")}</div>`;
    case "variableToken": {
      const key = String(node.attrs?.key ?? "");
      const fallback = node.attrs?.fallback ? String(node.attrs.fallback) : undefined;
      const text = renderVariableText(key, input.resolvedVariables, fallback);
      return `<span class="variable-token" data-variable-key="${escapeHtml(key)}">${escapeHtml(text)}</span>`;
    }
    case "contentBlockEmbed": {
      const blockId = String(node.attrs?.blockId ?? "");
      const version = String(node.attrs?.version ?? "1");
      const snapshotDoc = node.attrs?.snapshotDoc;
      if (snapshotDoc && typeof snapshotDoc === "object" && !Array.isArray(snapshotDoc)) {
        const doc = snapshotDoc as { content?: EditorNode[] };
        const inner = (doc.content ?? []).map((child) => renderNode(child, input)).join("");
        return `<div class="content-block-embed" data-block-id="${escapeHtml(blockId)}" data-block-version="${escapeHtml(version)}" data-pinned="true">${inner}</div>`;
      }
      return `<div class="content-block-embed" data-block-id="${escapeHtml(blockId)}" data-block-version="${escapeHtml(version)}">Saved library content (id ${escapeHtml(blockId)}, v${escapeHtml(version)}) is not inlined in this export.</div>`;
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
    case "fieldCanvas": {
      const inner = (node.content ?? []).map((child) => renderNode(child, input)).join("");
      const aspect = fieldCanvasAspectRatio(node.attrs?.pageWidth, node.attrs?.pageHeight);
      const bgKey = String(node.attrs?.bgKey ?? "");
      const background = bgKey
        ? `<img src="${escapeHtml(
            assetUrl(bgKey, { baseUrl: input.assetBaseUrl, token: input.assetToken }),
          )}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;" />`
        : "";
      // A page scan supplies its own border, so only draw the placeholder outline
      // for blank canvases.
      const border = bgKey ? "none" : "1px dashed rgba(148,163,184,0.85)";
      const surface = bgKey ? "#ffffff" : "rgba(248,250,252,0.65)";
      const minHeight = bgKey ? "" : "min-height:420px;";
      return `<div class="field-canvas rendered-field-canvas" data-node-type="fieldCanvas" style="position:relative;width:100%;aspect-ratio:${aspect};${minHeight}border:${border};border-radius:0.5rem;background:${surface};overflow:hidden;">${background}${inner}</div>`;
    }
    case "signerField":
      return renderSignerFieldNode(node, input);
    default:
      return (node.content ?? []).map((child) => renderNode(child, input)).join("");
  }
}

export function renderComputedHtml(input: RenderInput): string {
  const doc = migrateSignerFieldsDoc(input.doc);
  const body = doc.content.map((node) => renderNode(node, input)).join("");
  const backgrounds = renderPageBackgroundsHtml(doc, {
    assetBaseUrl: input.assetBaseUrl,
    assetToken: input.assetToken,
  });
  const article = backgrounds
    ? `<div class="print-root">${backgrounds}<article>${body}</article></div>`
    : `<article>${body}</article>`;
  if (input.mode !== "finalized") {
    return article;
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
  return `${article}<section class="certificate-page"><h2>Certificate</h2>${certificateBody}</section>`;
}
