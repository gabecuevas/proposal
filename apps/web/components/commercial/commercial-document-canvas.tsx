"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  calculateCommercialTotals,
  formatMoneyMinor,
  lineAmountMinor,
  moneyMinorToDisplay,
  parseMoneyInput,
  parseQuantityInput,
  quantityToDisplay,
} from "@/lib/commercial/calculate";
import {
  createBlankLineItem,
  DEFAULT_COMMERCIAL_THEME,
  PERCENT_SCALE,
  type CommercialDocument,
  type CommercialLineItem,
} from "@/lib/commercial/schema";
import { FLOW_GOOGLE_FONTS } from "@/lib/flow-document/google-fonts";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  COMPANY_LOGO_DISPLAY_HEIGHT,
  COMPANY_LOGO_DISPLAY_WIDTH,
  CompanyLogoModal,
} from "@/components/settings/company-logo-modal";
import { CommercialTokenField } from "./commercial-token-field";

export type CommercialTextFieldId = "sender" | "billTo" | "shipTo" | "notes" | "terms";

type Props = {
  commercial: CommercialDocument;
  onChange: (next: CommercialDocument) => void;
  /** Called after a logo is uploaded; should persist on the document and company settings. */
  onLogoKey: (key: string) => void | Promise<void>;
  onFieldFocus?: (field: CommercialTextFieldId, start: number, end: number) => void;
  readOnly?: boolean;
};

const fieldClass =
  "w-full rounded-[4px] border border-[#d7dee8] bg-white px-2 py-1.5 text-[13px] text-[#0f2744] outline-none placeholder:text-[#94a3b8] focus:border-[#0f2744] focus:ring-1 focus:ring-[#0f2744]";

function contrastTextColor(backgroundHex: string): string {
  const hex = backgroundHex.trim().replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => `${ch}${ch}`)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "#ffffff";
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f2744" : "#ffffff";
}

export function CommercialDocumentCanvas({
  commercial,
  onChange,
  onLogoKey,
  onFieldFocus,
  readOnly,
}: Props) {
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [companyLogoKey, setCompanyLogoKey] = useState<string | null>(null);
  const totals = calculateCommercialTotals({ document: commercial });
  const labels = commercial.labels;
  const theme = commercial.theme ?? DEFAULT_COMMERCIAL_THEME;
  const titleFont =
    FLOW_GOOGLE_FONTS.find((font) => font.id === theme.titleFontId) ?? FLOW_GOOGLE_FONTS[0]!;
  const isInvoice = commercial.type === "invoice";
  const money = (minor: number) => formatMoneyMinor(minor, commercial.currency, commercial.locale);
  const displayLogoKey = commercial.logoAssetKey || companyLogoKey;
  const tableHeaderFg = contrastTextColor(theme.tableHeaderBg);

  function reportField(field: CommercialTextFieldId, start: number, end: number) {
    onFieldFocus?.(field, start, end);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadCompanyLogo() {
      const response = await fetch("/api/workspace");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        workspace?: { logoAssetKey?: string | null };
      };
      if (!cancelled) {
        setCompanyLogoKey(payload.workspace?.logoAssetKey ?? null);
      }
    }
    void loadCompanyLogo();
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(partial: Partial<CommercialDocument>) {
    onChange({ ...commercial, ...partial });
  }

  function updateLine(id: string, partial: Partial<CommercialLineItem>) {
    patch({
      lineItems: commercial.lineItems.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    });
  }

  function moveLine(id: string, direction: -1 | 1) {
    const index = commercial.lineItems.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= commercial.lineItems.length) {
      return;
    }
    const next = [...commercial.lineItems];
    const [row] = next.splice(index, 1);
    next.splice(nextIndex, 0, row!);
    patch({ lineItems: next });
  }

  return (
    <div className="mx-auto w-full max-w-[900px] rounded-sm border border-[#d7dee8] bg-white p-6 shadow-[0_8px_28px_rgba(15,39,68,0.08)] sm:p-10">
      <div className="grid gap-3 md:grid-cols-2 md:items-start">
        <div className="min-w-0">
          {displayLogoKey ? (
            <div
              className="flex max-w-full items-center justify-start overflow-hidden"
              style={{ width: COMPANY_LOGO_DISPLAY_WIDTH, height: COMPANY_LOGO_DISPLAY_HEIGHT }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(displayLogoKey)}
                alt="Company logo"
                className="max-h-full max-w-full object-contain object-left"
                draggable={false}
              />
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setLogoModalOpen(true)}
                className="flex max-w-full items-center justify-center overflow-hidden rounded-sm border border-dashed border-[#d7dee8] bg-transparent text-sm text-[#64748b] hover:border-[#94a3b8] disabled:opacity-60"
                style={{ width: COMPANY_LOGO_DISPLAY_WIDTH, height: COMPANY_LOGO_DISPLAY_HEIGHT }}
                aria-label="Add your logo"
              >
                + Add Your Logo
              </button>
              <CompanyLogoModal
                open={logoModalOpen}
                currentLogoKey={null}
                title="Add company logo"
                onClose={() => setLogoModalOpen(false)}
                onUploaded={async (key) => {
                  setCompanyLogoKey(key);
                  await onLogoKey(key);
                  setLogoModalOpen(false);
                }}
              />
            </>
          )}
          <label className="mt-1 block">
            <span className="sr-only">Sender details</span>
            <CommercialTokenField
              value={commercial.sender.text}
              readOnly={readOnly}
              rows={4}
              aria-label="Sender details"
              onChange={(text) => patch({ sender: { ...commercial.sender, text } })}
              onFocusField={() =>
                reportField("sender", commercial.sender.text.length, commercial.sender.text.length)
              }
              onCaretChange={(start, end) => reportField("sender", start, end)}
              className={cn(fieldClass, "mt-0 min-h-[96px] w-full resize-y")}
            />
          </label>
        </div>

        <div className="min-w-0">
          {/* Fixed title slot so font/size changes don't shift meta rows below */}
          <div className="flex h-[72px] items-end justify-end overflow-visible">
            <h1
              className="max-w-full whitespace-nowrap text-right font-bold leading-none tracking-wide"
              style={{
                fontFamily: titleFont.family,
                color: theme.titleColor,
                fontSize: `${theme.titleSizePx}px`,
              }}
            >
              {labels.title || (isInvoice ? "INVOICE" : "QUOTE")}
            </h1>
          </div>
          <div className="mt-3 space-y-2">
            <MetaRow
              label={
                labels.documentNumber || (isInvoice ? "Invoice Number" : "Quote Number")
              }
              value={commercial.documentNumber}
              readOnly={readOnly}
              onChange={(value) => patch({ documentNumber: value })}
            />
            <MetaRow
              label={labels.date}
              value={commercial.issueDate ?? ""}
              readOnly={readOnly}
              onChange={(value) => patch({ issueDate: value || null })}
              type="date"
            />
            <PaymentTermsRow
              label={labels.paymentTerms}
              value={commercial.paymentTerms}
              readOnly={readOnly}
              onChange={(value) => patch({ paymentTerms: value })}
            />
            {isInvoice ? (
              <MetaRow
                label={labels.dueDate}
                value={commercial.dueDate ?? ""}
                readOnly={readOnly}
                onChange={(value) => patch({ dueDate: value || null })}
                type="date"
              />
            ) : null}
            <MetaRow
              label={labels.poNumber}
              value={commercial.poNumber}
              readOnly={readOnly}
              onChange={(value) => patch({ poNumber: value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <PartyBlock
          label={labels.billTo}
          value={commercial.billTo.text}
          readOnly={readOnly}
          onChange={(text) => patch({ billTo: { ...commercial.billTo, text } })}
          onFocusField={() =>
            reportField("billTo", commercial.billTo.text.length, commercial.billTo.text.length)
          }
          onCaretChange={(start, end) => reportField("billTo", start, end)}
        />
        <PartyBlock
          label={labels.shipTo}
          value={commercial.shipTo.text}
          placeholder="(optional)"
          readOnly={readOnly}
          onChange={(text) => patch({ shipTo: { ...commercial.shipTo, text } })}
          onFocusField={() =>
            reportField("shipTo", commercial.shipTo.text.length, commercial.shipTo.text.length)
          }
          onCaretChange={(start, end) => reportField("shipTo", start, end)}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: theme.tableHeaderBg, color: tableHeaderFg }}>
              <th className="px-3 py-2 text-left font-semibold">{labels.item}</th>
              <th className="w-24 px-2 py-2 text-right font-semibold">{labels.quantity}</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">{labels.rate}</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">{labels.amount}</th>
              {!readOnly ? <th className="w-16 px-1 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {commercial.lineItems.map((item, index) => (
              <tr key={item.id} className="align-top">
                <td className="px-1 py-2">
                  <textarea
                    value={item.description}
                    readOnly={readOnly}
                    placeholder="Description of item/service..."
                    rows={1}
                    onChange={(event) => updateLine(item.id, { description: event.target.value })}
                    className={cn(fieldClass, "min-h-[36px] resize-y")}
                    aria-label={`${labels.item} ${index + 1}`}
                  />
                </td>
                <td className="px-1 py-2">
                  <input
                    value={quantityToDisplay(item.quantityScaled)}
                    readOnly={readOnly}
                    inputMode="decimal"
                    onWheel={(event) => (event.target as HTMLInputElement).blur()}
                    onChange={(event) => {
                      const parsed = parseQuantityInput(event.target.value);
                      if (parsed == null) {
                        return;
                      }
                      updateLine(item.id, { quantityScaled: Math.max(0, parsed) });
                    }}
                    className={cn(fieldClass, "text-right")}
                    aria-label={`${labels.quantity} ${index + 1}`}
                  />
                </td>
                <td className="px-1 py-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#64748b]">
                      $
                    </span>
                    <MoneyAmountInput
                      minor={item.rateMinor}
                      currency={commercial.currency}
                      readOnly={readOnly}
                      className={cn(fieldClass, "pl-5 text-right")}
                      aria-label={`${labels.rate} ${index + 1}`}
                      onCommit={(rateMinor) => updateLine(item.id, { rateMinor })}
                    />
                  </div>
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-[#0f2744]">
                  {money(lineAmountMinor(item, totals.precision))}
                </td>
                {!readOnly ? (
                  <td className="px-1 py-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        className="text-[10px] text-muted hover:text-foreground"
                        onClick={() => moveLine(item.id, -1)}
                        aria-label={`Move item ${index + 1} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-muted hover:text-foreground"
                        onClick={() => moveLine(item.id, 1)}
                        aria-label={`Move item ${index + 1} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-red-600 hover:underline"
                        onClick={() =>
                          patch({
                            lineItems:
                              commercial.lineItems.length <= 1
                                ? [createBlankLineItem()]
                                : commercial.lineItems.filter((row) => row.id !== item.id),
                          })
                        }
                        aria-label={`Remove item ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => patch({ lineItems: [...commercial.lineItems, createBlankLineItem()] })}
            className="mt-1 flex w-full items-center justify-center rounded-sm bg-[#eef1f5] px-3 py-2.5 text-sm font-medium text-[#0f2744] hover:bg-[#e2e8f0]"
          >
            + Line Item
          </button>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#0f2744]">{labels.notes}</span>
            <CommercialTokenField
              value={commercial.notes}
              readOnly={readOnly}
              placeholder="Notes - any relevant information not already covered"
              rows={3}
              aria-label={labels.notes}
              onChange={(notes) => patch({ notes })}
              onFocusField={() => reportField("notes", commercial.notes.length, commercial.notes.length)}
              onCaretChange={(start, end) => reportField("notes", start, end)}
              className={cn(fieldClass, "min-h-[72px] resize-y")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#0f2744]">{labels.terms}</span>
            <CommercialTokenField
              value={commercial.terms}
              readOnly={readOnly}
              placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
              rows={3}
              aria-label={labels.terms}
              onChange={(terms) => patch({ terms })}
              onFocusField={() => reportField("terms", commercial.terms.length, commercial.terms.length)}
              onCaretChange={(start, end) => reportField("terms", start, end)}
              className={cn(fieldClass, "min-h-[72px] resize-y")}
            />
          </label>
        </div>

        <div className="space-y-2 text-[13px] text-[#0f2744]">
          <TotalRow label={labels.subtotal} value={money(totals.subtotalMinor)} />
          {commercial.discount.enabled ? (
            <div className="flex items-center justify-between gap-2">
              <span>{labels.discount}</span>
              <div className="flex items-center gap-1">
                <AdjustmentEditor
                  commercial={commercial}
                  kind="discount"
                  readOnly={readOnly}
                  onChange={patch}
                />
                <span className="tabular-nums">-{money(totals.discountMinor)}</span>
              </div>
            </div>
          ) : !readOnly ? (
            <button
              type="button"
              className="text-[#16a34a] hover:underline"
              onClick={() =>
                patch({ discount: { enabled: true, mode: "percent", valueScaled: 0 } })
              }
            >
              + Discount
            </button>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <span>{labels.tax}</span>
            <div className="flex items-center gap-1">
              <AdjustmentEditor commercial={commercial} kind="tax" readOnly={readOnly} onChange={patch} />
              <span className="tabular-nums">{money(totals.taxMinor)}</span>
            </div>
          </div>

          {commercial.shipping.enabled ? (
            <div className="flex items-center justify-between gap-2">
              <span>{labels.shipping}</span>
              <div className="flex items-center gap-1">
                <AdjustmentEditor
                  commercial={commercial}
                  kind="shipping"
                  readOnly={readOnly}
                  onChange={patch}
                />
                <span className="tabular-nums">{money(totals.shippingMinor)}</span>
              </div>
            </div>
          ) : !readOnly ? (
            <button
              type="button"
              className="text-[#16a34a] hover:underline"
              onClick={() =>
                patch({ shipping: { enabled: true, mode: "fixed", valueScaled: 0 } })
              }
            >
              + Shipping
            </button>
          ) : null}

          <div className="mt-2 flex items-center justify-between border-t border-[#cbd5e1] pt-2 text-[15px] font-bold">
            <span>{labels.total}</span>
            <span className="tabular-nums">{money(totals.totalMinor)}</span>
          </div>

          {isInvoice ? (
            <>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span>{labels.amountPaid}</span>
                <div className="relative w-24">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#64748b]">
                    $
                  </span>
                  <MoneyAmountInput
                    minor={commercial.amountPaidMinor}
                    currency={commercial.currency}
                    readOnly={readOnly}
                    className={cn(fieldClass, "pl-5 text-right")}
                    aria-label={labels.amountPaid}
                    onCommit={(amountPaidMinor) => patch({ amountPaidMinor })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#cbd5e1] pt-2 text-[16px] font-bold">
                <span>{labels.balanceDue}</span>
                <span className="tabular-nums">{money(totals.balanceDueMinor)}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[13px] text-[#0f2744]">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClass, "ml-auto w-[140px] shrink-0")}
        aria-label={label}
      />
    </div>
  );
}

const PAYMENT_TERMS_PRESETS = ["Due upon receipt", "Net 10", "Net 15", "Net 30"] as const;
const CUSTOM_TERMS_VALUE = "__custom_terms__";

function PaymentTermsRow({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || (PAYMENT_TERMS_PRESETS as readonly string[]).includes(trimmed)) {
      return;
    }
    setCustomTerms((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, [value]);

  useEffect(() => {
    if (!open && !addingCustom) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setAddingCustom(false);
        setCustomDraft("");
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setAddingCustom(false);
        setCustomDraft("");
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [addingCustom, open]);

  useEffect(() => {
    if (addingCustom) {
      customInputRef.current?.focus();
    }
  }, [addingCustom]);

  function selectPreset(next: string) {
    onChange(next);
    setOpen(false);
    setAddingCustom(false);
    setCustomDraft("");
  }

  function commitCustom() {
    const next = customDraft.trim();
    if (!next) {
      return;
    }
    setCustomTerms((prev) => (prev.includes(next) ? prev : [...prev, next]));
    onChange(next);
    setAddingCustom(false);
    setCustomDraft("");
    setOpen(false);
  }

  const display = value.trim() || "Select…";

  return (
    <div ref={rootRef} className="relative flex items-center justify-between gap-3">
      <span className="shrink-0 text-[13px] text-[#0f2744]">{label}</span>
      {readOnly ? (
        <span className={cn(fieldClass, "ml-auto flex w-[140px] shrink-0 items-center truncate bg-[#f8fafc]")}>
          {display}
        </span>
      ) : (
        <>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={label}
            onClick={() => {
              setOpen((current) => !current);
              setAddingCustom(false);
            }}
            className={cn(
              fieldClass,
              "ml-auto flex w-[140px] shrink-0 items-center justify-between gap-1 text-left",
            )}
          >
            <span className={cn("truncate", !value.trim() && "text-[#94a3b8]")}>{display}</span>
            <span className="shrink-0 text-[10px] text-[#64748b]" aria-hidden>
              ▾
            </span>
          </button>
          {open ? (
            <div
              role="listbox"
              aria-label={label}
              className="absolute right-0 top-full z-30 mt-1 w-[180px] overflow-hidden rounded-md border border-[#d7dee8] bg-white py-1 shadow-lg"
            >
              {PAYMENT_TERMS_PRESETS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => selectPreset(option)}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-[13px] text-[#0f2744] hover:bg-[#f1f5f9]",
                    value === option && "bg-[#eef1f5] font-medium",
                  )}
                >
                  {option}
                </button>
              ))}
              <div className="my-1 border-t border-[#e2e8f0]" role="separator" />
              {customTerms.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => selectPreset(option)}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-[13px] text-[#0f2744] hover:bg-[#f1f5f9]",
                    value === option && "bg-[#eef1f5] font-medium",
                  )}
                >
                  {option}
                </button>
              ))}
              {addingCustom ? (
                <div className="px-2 py-1.5">
                  <input
                    ref={customInputRef}
                    value={customDraft}
                    onChange={(event) => setCustomDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitCustom();
                      }
                    }}
                    placeholder="Custom terms"
                    aria-label="Custom payment terms"
                    className={cn(fieldClass, "w-full")}
                  />
                  <div className="mt-1.5 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCustom(false);
                        setCustomDraft("");
                      }}
                      className="rounded px-2 py-1 text-[11px] text-[#64748b] hover:bg-[#f1f5f9]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={commitCustom}
                      disabled={!customDraft.trim()}
                      className="rounded bg-[#0f2744] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  data-value={CUSTOM_TERMS_VALUE}
                  onClick={() => setAddingCustom(true)}
                  className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-[#16a34a] hover:bg-[#f1f5f9]"
                >
                  + Custom Terms
                </button>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function PartyBlock({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
  onFocusField,
  onCaretChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  onFocusField?: () => void;
  onCaretChange?: (start: number, end: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#0f2744]">{label}</span>
      <CommercialTokenField
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={3}
        aria-label={label}
        onChange={onChange}
        onFocusField={onFocusField}
        onCaretChange={onCaretChange}
        className={cn(fieldClass, "min-h-[72px] resize-y")}
      />
    </label>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Money field that keeps a free-form draft while focused so typing "199"
 * does not get reformatted to "1.00" → "1.02" mid-keystroke.
 */
function MoneyAmountInput({
  minor,
  currency,
  onCommit,
  readOnly,
  className,
  "aria-label": ariaLabel,
}: {
  minor: number;
  currency: string;
  onCommit: (minor: number) => void;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? moneyMinorToDisplay(minor, currency);

  return (
    <input
      value={display}
      readOnly={readOnly}
      inputMode="decimal"
      aria-label={ariaLabel}
      className={className}
      onWheel={(event) => (event.target as HTMLInputElement).blur()}
      onFocus={(event) => {
        setDraft(moneyMinorToDisplay(minor, currency));
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const raw = event.target.value;
        // Allow digits, one decimal point, and empty while editing.
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw.replace(/[$,\s]/g, ""))) {
          return;
        }
        setDraft(raw);
        const parsed = parseMoneyInput(raw, currency);
        if (parsed != null) {
          onCommit(parsed);
        }
      }}
      onBlur={(event) => {
        const parsed = parseMoneyInput(event.target.value, currency);
        onCommit(parsed ?? 0);
        setDraft(null);
      }}
    />
  );
}

function AdjustmentEditor({
  commercial,
  kind,
  readOnly,
  onChange,
}: {
  commercial: CommercialDocument;
  kind: "discount" | "tax" | "shipping";
  readOnly?: boolean;
  onChange: (partial: Partial<CommercialDocument>) => void;
}) {
  const adjustment = commercial[kind];
  if (kind === "shipping") {
    return (
      <MoneyAmountInput
        minor={adjustment.valueScaled}
        currency={commercial.currency}
        readOnly={readOnly}
        className={cn(fieldClass, "w-16 text-right")}
        aria-label={commercial.labels.shipping}
        onCommit={(valueScaled) =>
          onChange({ shipping: { ...adjustment, mode: "fixed", valueScaled } })
        }
      />
    );
  }

  const isPercent = adjustment.mode === "percent";
  return (
    <div className="flex items-center gap-1">
      {isPercent ? (
        <input
          value={String(adjustment.valueScaled / PERCENT_SCALE)}
          readOnly={readOnly}
          inputMode="decimal"
          onWheel={(event) => (event.target as HTMLInputElement).blur()}
          onChange={(event) => {
            const n = Number(event.target.value);
            if (!Number.isFinite(n)) {
              return;
            }
            onChange({
              [kind]: {
                ...adjustment,
                valueScaled: Math.round(n * PERCENT_SCALE),
              },
            } as Partial<CommercialDocument>);
          }}
          className={cn(fieldClass, "w-14 text-right")}
          aria-label={kind === "tax" ? commercial.labels.tax : commercial.labels.discount}
        />
      ) : (
        <MoneyAmountInput
          minor={adjustment.valueScaled}
          currency={commercial.currency}
          readOnly={readOnly}
          className={cn(fieldClass, "w-14 text-right")}
          aria-label={kind === "tax" ? commercial.labels.tax : commercial.labels.discount}
          onCommit={(valueScaled) =>
            onChange({
              [kind]: { ...adjustment, valueScaled },
            } as Partial<CommercialDocument>)
          }
        />
      )}
      <button
        type="button"
        disabled={readOnly}
        title="Toggle percent / fixed"
        onClick={() =>
          onChange({
            [kind]: {
              ...adjustment,
              mode: isPercent ? "fixed" : "percent",
              valueScaled: 0,
            },
          } as Partial<CommercialDocument>)
        }
        className="rounded border border-[#d7dee8] px-1 text-[10px] text-[#64748b] hover:bg-slate-50"
      >
        {isPercent ? "%" : "$"}
      </button>
    </div>
  );
}
