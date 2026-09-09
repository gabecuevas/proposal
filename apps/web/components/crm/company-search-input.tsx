"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  searchCompanies,
  type CompanySearchResult,
} from "@/lib/crm/resolve-company-association";

type CompanySearchInputProps = {
  value: string;
  placeholder?: string;
  className?: string;
  onValueChange: (value: string) => void;
  onCompanySelect: (company: CompanySearchResult) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function CompanySearchInput({
  value,
  placeholder,
  className,
  onValueChange,
  onCompanySelect,
  onKeyDown,
}: CompanySearchInputProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(value), 250);
    return () => window.clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    async function runSearch() {
      const query = debouncedQuery.trim();
      if (query.length < 1) {
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      setLoading(true);
      const matches = await searchCompanies(query, 8);
      if (cancelled) {
        return;
      }
      setResults(matches);
      setOpen(matches.length > 0);
      setActiveIndex(matches.length > 0 ? 0 : -1);
      setLoading(false);
    }
    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function selectCompany(company: CompanySearchResult) {
    onCompanySelect(company);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        autoFocus
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open && results.length > 0) {
              setOpen(true);
              setActiveIndex(0);
              return;
            }
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
            return;
          }
          if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
            event.preventDefault();
            selectCompany(results[activeIndex]!);
            return;
          }
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          onKeyDown?.(event);
        }}
      />
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching companies</li>
          ) : (
            results.map((company, index) => (
              <li key={company.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50",
                    index === activeIndex && "bg-slate-50",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCompany(company)}
                >
                  <span className="font-medium text-foreground">{company.name}</span>
                  {company.city || company.industry ? (
                    <span className="text-xs text-muted">
                      {[company.city, company.industry].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
