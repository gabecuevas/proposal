"use client";

import Link from "next/link";
import { cn } from "@repo/ui/utils";
import { SheetPage } from "@/components/ui/sheet-table";

export type CatalogKind = "products" | "services";

const TABS: Array<{ id: CatalogKind; label: string; href: string }> = [
  { id: "products", label: "Products", href: "/app/catalog/products" },
  { id: "services", label: "Services", href: "/app/catalog/services" },
];

const COPY: Record<
  CatalogKind,
  { noun: string; plural: string; description: string }
> = {
  products: {
    noun: "product",
    plural: "products",
    description:
      "Build your product catalog so Quotes can pull line items with names, descriptions, and pricing.",
  },
  services: {
    noun: "service",
    plural: "services",
    description:
      "Build your service catalog so Quotes can pull billable offerings with rates and descriptions.",
  },
};

type Props = {
  kind: CatalogKind;
};

/**
 * Placeholder Catalog shelf. Upload/import and Quote line-item wiring land next.
 */
export function CatalogShelfPage({ kind }: Props) {
  const copy = COPY[kind];

  return (
    <SheetPage
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
              disabled
              title="Coming soon"
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground opacity-60"
            >
              + Add {copy.noun}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No {copy.plural} yet</p>
        <p className="mt-2 max-w-md text-sm text-muted">{copy.description}</p>
        <p className="mt-4 text-xs text-muted">
          Use <span className="font-medium text-foreground">+ New Document → Quote</span> once items
          are in your catalog.
        </p>
      </div>
    </SheetPage>
  );
}
