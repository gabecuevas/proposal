"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@repo/ui/utils";
import { CatalogItemModal } from "@/components/catalog/catalog-item-modal";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import { formatMoneyMinor } from "@/lib/commercial/calculate";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/commercial/currencies";
import type { CatalogItemDto } from "@/lib/catalog/items";

export type CatalogKind = "products" | "services";

const TABS: Array<{ id: CatalogKind; label: string; href: string }> = [
  { id: "products", label: "Products", href: "/app/catalog/products" },
  { id: "services", label: "Services", href: "/app/catalog/services" },
];

const COPY: Record<
  CatalogKind,
  { noun: "product" | "service"; plural: string; priceLabel: string; description: string }
> = {
  products: {
    noun: "product",
    plural: "products",
    priceLabel: "Unit price",
    description:
      "Build your product catalog so Quotes and Invoices can pull line items with names and pricing.",
  },
  services: {
    noun: "service",
    plural: "services",
    priceLabel: "Rate",
    description:
      "Build your service catalog so Quotes and Invoices can pull billable offerings with rates.",
  },
};

type Props = {
  kind: CatalogKind;
};

export function CatalogShelfPage({ kind }: Props) {
  const copy = COPY[kind];
  const [items, setItems] = useState<CatalogItemDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<string>(DEFAULT_CURRENCY);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workspace")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { workspace?: { currency?: string | null } };
        if (!cancelled) setDefaultCurrency(normalizeCurrency(payload.workspace?.currency));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ kind: copy.noun });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const response = await fetch(`/api/catalog/items?${params.toString()}`).catch(() => null);
    setLoaded(true);
    if (!response?.ok) {
      setError(`Unable to load ${copy.plural}`);
      return;
    }
    setError("");
    const payload = (await response.json()) as { items: CatalogItemDto[] };
    setItems(payload.items);
  }, [copy.noun, copy.plural, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 200 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  return (
    <SheetPage
      error={error || undefined}
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const active = tab.id === kind;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/[0.08] font-medium text-primary"
                      : "text-muted hover:bg-slate-100/80 hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${copy.plural}…`}
              className="h-8 w-56 rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
            />
            <button
              type="button"
              disabled
              title="Coming soon"
              className="h-8 rounded-md border border-border bg-white px-3 text-xs font-medium text-muted"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-95"
            >
              + Add {copy.noun}
            </button>
          </div>
        </div>
      }
    >
      {loaded && items.length === 0 && !query ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No {copy.plural} yet</p>
          <p className="mt-2 max-w-md text-sm text-muted">{copy.description}</p>
          <p className="mt-4 text-xs text-muted">
            You can also add them while typing a line item on a Quote or Invoice.
          </p>
        </div>
      ) : (
        <SheetTable
          empty={
            !loaded ? (
              <p className="p-4 text-sm text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted">No {copy.plural} match “{query}”.</p>
            ) : null
          }
        >
          <thead>
            <tr>
              <th className={sheetTh()}>Name</th>
              <th className={sheetTh("w-40 text-right")}>{copy.priceLabel}</th>
              <th className={sheetTh("w-40")}>Added</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={sheetTr()}>
                <td className={sheetTd("font-medium text-foreground")}>{item.name}</td>
                <td className={sheetTd("text-right tabular-nums")}>
                  {formatMoneyMinor(item.unitPriceMinor, item.currency)}
                </td>
                <td className={sheetTd()}>{new Date(item.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </SheetTable>
      )}

      <CatalogItemModal
        open={modalOpen}
        initialKind={copy.noun}
        currency={defaultCurrency}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </SheetPage>
  );
}
