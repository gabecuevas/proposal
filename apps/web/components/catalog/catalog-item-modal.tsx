"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@repo/ui/utils";
import { moneyMinorToDisplay, parseMoneyInput } from "@/lib/commercial/calculate";
import { currencySymbol } from "@/lib/commercial/currencies";
import type { CatalogItemDto, CatalogItemKind } from "@/lib/catalog/items";

type Props = {
  open: boolean;
  initialName?: string;
  initialKind?: CatalogItemKind;
  initialPriceMinor?: number;
  currency?: string;
  onClose: () => void;
  onCreated: (item: CatalogItemDto) => void;
};

const KIND_OPTIONS: Array<{ id: CatalogItemKind; label: string; hint: string }> = [
  { id: "product", label: "Product", hint: "Physical or digital goods" },
  { id: "service", label: "Service", hint: "Billable work or time" },
];

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-primary/15 focus:border-primary/40 focus:ring-2";

export function CatalogItemModal({
  open,
  initialName = "",
  initialKind = "product",
  initialPriceMinor = 0,
  currency = "USD",
  onClose,
  onCreated,
}: Props) {
  const [kind, setKind] = useState<CatalogItemKind>(initialKind);
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    if (!open) {
      return;
    }
    setKind(initialKind);
    setName(initialName);
    setPrice(initialPriceMinor > 0 ? moneyMinorToDisplay(initialPriceMinor, currency) : "");
    setError("");
    setBusy(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [currency, initialKind, initialName, initialPriceMinor, open]);

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
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const priceLabel = kind === "service" ? "Rate" : "Unit price";

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(`Enter a ${kind} name.`);
      return;
    }
    const unitPriceMinor = price.trim() ? parseMoneyInput(price, currency) : 0;
    if (unitPriceMinor == null || unitPriceMinor < 0) {
      setError(`Enter a valid ${priceLabel.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/catalog/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name: trimmed, unitPriceMinor, currency }),
    }).catch(() => null);
    const payload = (await response?.json().catch(() => null)) as
      | { item?: CatalogItemDto; error?: { message?: string } }
      | null;
    setBusy(false);
    if (!response?.ok || !payload?.item) {
      setError(payload?.error?.message ?? "Could not save. Try again.");
      return;
    }
    onCreated(payload.item);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-item-modal-title"
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h3 id="catalog-item-modal-title" className="text-base font-semibold text-foreground">
          Add to Catalog
        </h3>
        <p className="mt-1 text-sm text-muted">Saved items appear in the line-item search on Quotes and Invoices.</p>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-xs font-medium text-muted">Type</legend>
          <div className="grid grid-cols-2 gap-2">
            {KIND_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer flex-col rounded-md border px-3 py-2 text-sm transition-colors",
                  kind === option.id
                    ? "border-primary bg-primary/[0.06] text-foreground"
                    : "border-border text-muted hover:border-slate-300",
                )}
              >
                <input
                  type="radio"
                  name="catalog-kind"
                  value={option.id}
                  checked={kind === option.id}
                  onChange={() => setKind(option.id)}
                  className="sr-only"
                />
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            {kind === "service" ? "Service name" : "Product name"}
          </span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
            className={inputClass}
            placeholder={kind === "service" ? "e.g. Website design" : "e.g. Standing desk"}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            {priceLabel} ({currency})
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              {symbol}
            </span>
            <input
              value={price}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === "" || /^\d*\.?\d*$/.test(raw.replace(/[$,\s]/g, ""))) {
                  setPrice(raw);
                }
              }}
              inputMode="decimal"
              className={cn(inputClass, symbol.length <= 1 ? "pl-7" : symbol.length === 2 ? "pl-9" : "pl-11")}
              placeholder="0.00"
            />
          </div>
        </label>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Saving…" : `Add ${kind}`}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
