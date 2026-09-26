"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@repo/ui/utils";
import { CatalogItemModal } from "@/components/catalog/catalog-item-modal";
import { formatMoneyMinor } from "@/lib/commercial/calculate";
import type { CatalogItemDto } from "@/lib/catalog/items";

const MAX_SUGGESTIONS = 6;
const CATALOG_CACHE_MS = 60_000;

let catalogCache: CatalogItemDto[] | null = null;
let catalogFetchedAt = 0;
let catalogRequest: Promise<CatalogItemDto[]> | null = null;
const catalogListeners = new Set<(items: CatalogItemDto[]) => void>();

function publishCatalog(items: CatalogItemDto[]) {
  catalogCache = items;
  for (const listener of catalogListeners) {
    listener(items);
  }
}

async function loadCatalog(): Promise<CatalogItemDto[]> {
  if (catalogCache && Date.now() - catalogFetchedAt < CATALOG_CACHE_MS) {
    return catalogCache;
  }
  catalogRequest ??= fetch("/api/catalog/items")
    .then(async (response) => {
      if (!response.ok) {
        return [];
      }
      const payload = (await response.json()) as { items?: CatalogItemDto[] };
      return payload.items ?? [];
    })
    .catch(() => [] as CatalogItemDto[])
    .then((items) => {
      catalogFetchedAt = Date.now();
      publishCatalog(items);
      return items;
    })
    .finally(() => {
      catalogRequest = null;
    });
  return catalogRequest;
}

function useCatalogItems(enabled: boolean): CatalogItemDto[] {
  const [items, setItems] = useState<CatalogItemDto[]>(catalogCache ?? []);
  useEffect(() => {
    catalogListeners.add(setItems);
    return () => {
      catalogListeners.delete(setItems);
    };
  }, []);
  useEffect(() => {
    if (enabled) {
      void loadCatalog();
    }
  }, [enabled]);
  return items;
}

type Props = {
  value: string;
  currency: string;
  locale?: string;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
  onChange: (description: string) => void;
  onPick: (item: CatalogItemDto) => void;
};

export function LineItemDescriptionField({
  value,
  currency,
  locale,
  readOnly,
  className,
  "aria-label": ariaLabel,
  onChange,
  onPick,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const catalog = useCatalogItems(focused);

  const query = value.trim();
  const matches = useMemo(() => {
    if (!query) {
      return [];
    }
    const lower = query.toLowerCase();
    return catalog
      .filter((item) => item.name.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [catalog, query]);
  const exactMatch = matches.some((item) => item.name.toLowerCase() === query.toLowerCase());
  const showAddNew = Boolean(query) && !exactMatch;
  const optionCount = matches.length + (showAddNew ? 1 : 0);
  const open = !readOnly && focused && !dismissed && optionCount > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    function measure() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) {
        setAnchor({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
      }
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, value]);

  const pick = useCallback(
    (item: CatalogItemDto) => {
      onPick(item);
      setDismissed(true);
    },
    [onPick],
  );

  function openAddNew() {
    setDismissed(true);
    setModalOpen(true);
  }

  function choose(index: number) {
    const item = matches[index];
    if (item) {
      pick(item);
    } else if (showAddNew) {
      openAddNew();
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <textarea
        ref={inputRef}
        value={value}
        readOnly={readOnly}
        placeholder="Description of item/service..."
        rows={1}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onChange={(event) => {
          setFocused(true);
          setDismissed(false);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (!open) {
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % optionCount);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + optionCount) % optionCount);
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            choose(activeIndex);
          } else if (event.key === "Escape") {
            setDismissed(true);
          }
        }}
        className={className}
      />

      {open && anchor
        ? createPortal(
        <div
          id={listId}
          role="listbox"
          style={{ position: "fixed", top: anchor.top, left: anchor.left, width: anchor.width }}
          className="z-[55] overflow-hidden rounded-md border border-[#d7dee8] bg-white py-1 shadow-lg"
        >
          {matches.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(item)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#0f2744]",
                index === activeIndex && "bg-[#f1f5f9]",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 rounded border border-[#e2e8f0] px-1.5 text-[10px] uppercase tracking-wide text-[#64748b]">
                {item.kind}
              </span>
              <span className="w-20 shrink-0 text-right tabular-nums text-[#64748b]">
                {formatMoneyMinor(item.unitPriceMinor, item.currency || currency, locale)}
              </span>
            </button>
          ))}
          {showAddNew ? (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === matches.length}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(matches.length)}
              onClick={openAddNew}
              className={cn(
                "flex w-full items-center gap-1 px-3 py-1.5 text-left text-[13px] font-medium text-[#16a34a]",
                matches.length > 0 && "border-t border-[#e2e8f0]",
                activeIndex === matches.length && "bg-[#f1f5f9]",
              )}
            >
              + Add New Product/Service
              <span className="min-w-0 truncate font-normal text-[#64748b]">“{query}”</span>
            </button>
          ) : null}
        </div>,
            document.body,
          )
        : null}

      <CatalogItemModal
        open={modalOpen}
        initialName={query}
        currency={currency}
        onClose={() => setModalOpen(false)}
        onCreated={(item) => {
          setModalOpen(false);
          publishCatalog([...(catalogCache ?? []), item]);
          pick(item);
        }}
      />
    </div>
  );
}