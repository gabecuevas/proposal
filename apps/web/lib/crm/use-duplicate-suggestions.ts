"use client";

import { useEffect, useState } from "react";
import type { DuplicateField, DuplicateMatch } from "@/lib/crm/duplicate-search";
import { duplicateSearchReady } from "@/lib/crm/duplicate-search";

type UseDuplicateSuggestionsOptions = {
  enabled: boolean;
  excludeContactId?: string;
  excludeCompanyId?: string;
  excludeLeadId?: string;
};

const DEBOUNCE_MS = 350;

export function useDuplicateSuggestions(
  field: DuplicateField,
  value: string,
  options: UseDuplicateSuggestionsOptions,
) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!options.enabled || !duplicateSearchReady(field, value)) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ field, value: value.trim() });
          if (options.excludeContactId) {
            params.set("excludeContactId", options.excludeContactId);
          }
          if (options.excludeCompanyId) {
            params.set("excludeCompanyId", options.excludeCompanyId);
          }
          if (options.excludeLeadId) {
            params.set("excludeLeadId", options.excludeLeadId);
          }
          const response = await fetch(`/api/crm/duplicates?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            if (!controller.signal.aborted) {
              setMatches([]);
            }
            return;
          }
          const payload = (await response.json()) as { matches?: DuplicateMatch[] };
          if (!controller.signal.aborted) {
            setMatches(payload.matches ?? []);
          }
        } catch {
          if (!controller.signal.aborted) {
            setMatches([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    field,
    value,
    options.enabled,
    options.excludeContactId,
    options.excludeCompanyId,
    options.excludeLeadId,
  ]);

  return { matches, loading };
}
