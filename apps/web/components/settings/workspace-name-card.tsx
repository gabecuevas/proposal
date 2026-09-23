"use client";

import { useEffect, useState } from "react";
import { cn } from "@repo/ui/utils";
import { crmInputClass } from "@/components/crm/variable-pills";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  COMPANY_LOGO_DISPLAY_HEIGHT,
  COMPANY_LOGO_DISPLAY_WIDTH,
  COMPANY_LOGO_SUGGESTED_SIZE,
  CompanyLogoModal,
} from "@/components/settings/company-logo-modal";

export function WorkspaceNameCard() {
  const [name, setName] = useState("");
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/workspace");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        workspace?: { name?: string; logoAssetKey?: string | null };
      };
      if (!cancelled) {
        setName(payload.workspace?.name ?? "");
        setLogoKey(payload.workspace?.logoAssetKey ?? null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveName() {
    setStatus("");
    setError("");
    const response = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError("Failed to save company name");
      return;
    }
    setStatus("Company settings saved.");
  }

  async function saveLogoKey(nextKey: string | null) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoAssetKey: nextKey }),
      });
      if (!response.ok) {
        throw new Error("Failed to save company logo");
      }
      setLogoKey(nextKey);
      setStatus(nextKey ? "Company logo saved." : "Company logo removed.");
      setLogoModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">Company settings</h2>
      <p className="mt-1 text-sm text-muted">
        This name and logo appear on Quotes, Invoices, and across your workspace.
      </p>

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium text-foreground">Company logo</p>
        <p className="mb-3 text-xs text-muted">
          Suggested size {COMPANY_LOGO_SUGGESTED_SIZE}. Displayed at{" "}
          {COMPANY_LOGO_DISPLAY_WIDTH}×{COMPANY_LOGO_DISPLAY_HEIGHT}px without stretching.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => setLogoModalOpen(true)}
            className={cn(
              "flex items-center justify-center overflow-hidden text-sm text-muted",
              logoKey
                ? "border-0 bg-transparent hover:opacity-90"
                : "rounded-md border border-dashed border-border bg-transparent hover:border-primary/40 hover:text-foreground",
            )}
            style={{ width: COMPANY_LOGO_DISPLAY_WIDTH, height: COMPANY_LOGO_DISPLAY_HEIGHT }}
            aria-label={logoKey ? "Change company logo" : "Add company logo"}
          >
            {logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(logoKey)}
                alt="Company logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              "+ Add Your Logo"
            )}
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLogoModalOpen(true)}
              className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground hover:bg-slate-50"
            >
              {logoKey ? "Replace logo" : "Upload logo"}
            </button>
            {logoKey ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveLogoKey(null)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-40"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-sm font-medium text-foreground">Company name</p>
        <div className="flex flex-wrap gap-2">
          <input
            className={`max-w-md flex-1 ${crmInputClass()}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Company name"
          />
          <button
            type="button"
            onClick={() => void saveName()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Save
          </button>
        </div>
      </div>

      {status ? <p className="mt-2 text-sm text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <CompanyLogoModal
        open={logoModalOpen}
        currentLogoKey={logoKey}
        busy={busy}
        onClose={() => setLogoModalOpen(false)}
        onUploaded={(key) => void saveLogoKey(key)}
      />
    </section>
  );
}
