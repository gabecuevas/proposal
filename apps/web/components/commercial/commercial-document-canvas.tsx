"use client";

import { useEffect, useState } from "react";
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
  PERCENT_SCALE,
  type CommercialDocument,
  type CommercialLineItem,
} from "@/lib/commercial/schema";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  COMPANY_LOGO_DISPLAY_HEIGHT,
  COMPANY_LOGO_DISPLAY_WIDTH,
  CompanyLogoModal,
} from "@/components/settings/company-logo-modal";

type Props = {
  commercial: CommercialDocument;
  onChange: (next: CommercialDocument) => void;
  /** Called after a logo is uploaded; should persist on the document and company settings. */
  onLogoKey: (key: string) => void | Promise<void>;
  readOnly?: boolean;
};

const fieldClass =
  "w-full rounded-[4px] border border-[#d7dee8] bg-white px-2 py-1.5 text-[13px] text-[#0f2744] outline-none placeholder:text-[#94a3b8] focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]";

export function CommercialDocumentCanvas({ commercial, onChange, onLogoKey, readOnly }: Props) {
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [companyLogoKey, setCompanyLogoKey] = useState<string | null>(null);
  const totals = calculateCommercialTotals({ document: commercial });
  const labels = commercial.labels;
  const isInvoice = commercial.type === "invoice";
  const money = (minor: number) => formatMoneyMinor(minor, commercial.currency, commercial.locale);
  const displayLogoKey = commercial.logoAssetKey || companyLogoKey;

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
      <div className="flex flex-col gap-6 md:flex-row md:justify-between">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setLogoModalOpen(true)}
            className="flex items-center justify-center overflow-hidden rounded-sm border border-[#d7dee8] bg-[#f8fafc] text-sm text-[#64748b] hover:border-[#94a3b8] disabled:opacity-60"
            style={{ width: COMPANY_LOGO_DISPLAY_WIDTH, height: COMPANY_LOGO_DISPLAY_HEIGHT }}
            aria-label={displayLogoKey ? "Change logo" : "Add your logo"}
          >
            {displayLogoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(displayLogoKey)}
                alt="Company logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              "+ Add Your Logo"
            )}
          </button>
          <CompanyLogoModal
            open={logoModalOpen}
            currentLogoKey={displayLogoKey}
            title="Add company logo"
            onClose={() => setLogoModalOpen(false)}
            onUploaded={async (key) => {
              setCompanyLogoKey(key);
              await onLogoKey(key);
              setLogoModalOpen(false);
            }}
          />
          <label className="mt-3 block">
            <span className="sr-only">Sender details</span>
            <textarea
              value={commercial.sender.text}
              readOnly={readOnly}
              onChange={(event) => patch({ sender: { ...commercial.sender, text: event.target.value } })}
              rows={4}
              className={cn(fieldClass, "mt-0 min-h-[96px] resize-y")}
            />
          </label>
        </div>

        <div className="w-full shrink-0 md:w-[260px]">
          <h1 className="text-[40px] font-bold leading-none tracking-wide text-[#0f2744] sm:text-[44px]">
            {labels.title || (isInvoice ? "INVOICE" : "QUOTE")}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-[#0f2744]">#</span>
            <input
              value={commercial.documentNumber}
              readOnly={readOnly}
              onChange={(event) => patch({ documentNumber: event.target.value })}
              className={cn(fieldClass, "w-24")}
              aria-label="Document number"
            />
          </div>
          <div className="mt-4 space-y-2">
            <MetaRow
              label={labels.date}
              value={commercial.issueDate ?? ""}
              readOnly={readOnly}
              onChange={(value) => patch({ issueDate: value || null })}
              type="date"
            />
            <MetaRow
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
        />
        <PartyBlock
          label={labels.shipTo}
          value={commercial.shipTo.text}
          placeholder="(optional)"
          readOnly={readOnly}
          onChange={(text) => patch({ shipTo: { ...commercial.shipTo, text } })}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#0f2744] text-white">
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
                    <input
                      value={moneyMinorToDisplay(item.rateMinor, commercial.currency)}
                      readOnly={readOnly}
                      inputMode="decimal"
                      onWheel={(event) => (event.target as HTMLInputElement).blur()}
                      onChange={(event) => {
                        const parsed = parseMoneyInput(event.target.value, commercial.currency);
                        if (parsed == null) {
                          return;
                        }
                        updateLine(item.id, { rateMinor: parsed });
                      }}
                      className={cn(fieldClass, "pl-5 text-right")}
                      aria-label={`${labels.rate} ${index + 1}`}
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
            <textarea
              value={commercial.notes}
              readOnly={readOnly}
              placeholder="Notes - any relevant information not already covered"
              rows={3}
              onChange={(event) => patch({ notes: event.target.value })}
              className={cn(fieldClass, "min-h-[72px] resize-y")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#0f2744]">{labels.terms}</span>
            <textarea
              value={commercial.terms}
              readOnly={readOnly}
              placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
              rows={3}
              onChange={(event) => patch({ terms: event.target.value })}
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
                  <input
                    value={moneyMinorToDisplay(commercial.amountPaidMinor, commercial.currency)}
                    readOnly={readOnly}
                    inputMode="decimal"
                    onWheel={(event) => (event.target as HTMLInputElement).blur()}
                    onChange={(event) => {
                      const parsed = parseMoneyInput(event.target.value, commercial.currency);
                      if (parsed == null) {
                        return;
                      }
                      patch({ amountPaidMinor: parsed });
                    }}
                    className={cn(fieldClass, "pl-5 text-right")}
                    aria-label={labels.amountPaid}
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
      <span className="text-[13px] text-[#0f2744]">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClass, "w-[140px]")}
        aria-label={label}
      />
    </div>
  );
}

function PartyBlock({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#0f2744]">{label}</span>
      <textarea
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
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
      <input
        value={moneyMinorToDisplay(adjustment.valueScaled, commercial.currency)}
        readOnly={readOnly}
        inputMode="decimal"
        onWheel={(event) => (event.target as HTMLInputElement).blur()}
        onChange={(event) => {
          const parsed = parseMoneyInput(event.target.value, commercial.currency);
          if (parsed == null) {
            return;
          }
          onChange({ shipping: { ...adjustment, mode: "fixed", valueScaled: parsed } });
        }}
        className={cn(fieldClass, "w-16 text-right")}
        aria-label={commercial.labels.shipping}
      />
    );
  }

  const isPercent = adjustment.mode === "percent";
  return (
    <div className="flex items-center gap-1">
      <input
        value={
          isPercent
            ? String(adjustment.valueScaled / PERCENT_SCALE)
            : moneyMinorToDisplay(adjustment.valueScaled, commercial.currency)
        }
        readOnly={readOnly}
        inputMode="decimal"
        onWheel={(event) => (event.target as HTMLInputElement).blur()}
        onChange={(event) => {
          if (isPercent) {
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
            return;
          }
          const parsed = parseMoneyInput(event.target.value, commercial.currency);
          if (parsed == null) {
            return;
          }
          onChange({
            [kind]: { ...adjustment, valueScaled: parsed },
          } as Partial<CommercialDocument>);
        }}
        className={cn(fieldClass, "w-14 text-right")}
        aria-label={kind === "tax" ? commercial.labels.tax : commercial.labels.discount}
      />
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
