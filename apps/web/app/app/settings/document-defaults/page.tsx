"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { SheetPadded } from "@/components/ui/sheet-table";
import { currencyLabel } from "@/lib/commercial/currencies";

type WorkspaceDefaults = {
  currency: string;
  timezone: string;
  locale: string;
  quoteValidityDays: number | null;
  invoicePaymentTermDays: number | null;
  updatedAt: string;
};

export default function SettingsDocumentDefaultsPage() {
  const [form, setForm] = useState<WorkspaceDefaults>({
    currency: "USD",
    timezone: "America/Los_Angeles",
    locale: "en-US",
    quoteValidityDays: 30,
    invoicePaymentTermDays: 30,
    updatedAt: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/workspace", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { workspace?: Partial<WorkspaceDefaults> & { currency?: string | null; timezone?: string | null; locale?: string | null } };
        const w = payload.workspace;
        if (!w) return;
        setForm({
          currency: w.currency ?? "USD",
          timezone: w.timezone ?? "America/Los_Angeles",
          locale: w.locale ?? "en-US",
          quoteValidityDays: w.quoteValidityDays ?? 30,
          invoicePaymentTermDays: w.invoicePaymentTermDays ?? 30,
          updatedAt: w.updatedAt ?? "",
        });
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        timezone: form.timezone,
        locale: form.locale,
        quoteValidityDays: form.quoteValidityDays,
        invoicePaymentTermDays: form.invoicePaymentTermDays,
        expectedUpdatedAt: form.updatedAt || undefined,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to save defaults");
      return;
    }
    const payload = (await response.json()) as { workspace?: WorkspaceDefaults };
    if (payload.workspace) {
      setForm({
        currency: payload.workspace.currency ?? form.currency,
        timezone: payload.workspace.timezone ?? form.timezone,
        locale: payload.workspace.locale ?? form.locale,
        quoteValidityDays: payload.workspace.quoteValidityDays,
        invoicePaymentTermDays: payload.workspace.invoicePaymentTermDays,
        updatedAt: payload.workspace.updatedAt,
      });
    }
    setMessage("Document defaults saved.");
  }

  return (
    <SheetPadded>
      <h1 className="text-sm font-semibold text-foreground">Document defaults</h1>
      <p className="mt-2 text-sm text-muted">
        Applied when creating new quotes and invoices. Existing documents are not changed.
      </p>
      <form className="mt-6 max-w-md space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="text-sm">
          <span className="mb-1 block text-muted">Default currency</span>
          <p className="text-foreground">
            {currencyLabel(form.currency)}{" "}
            <Link href="/app/settings/company" className="text-primary hover:underline">
              Change in Company settings
            </Link>
          </p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Time zone</span>
          <input
            className="w-full rounded-none border border-border bg-surface px-3 py-2"
            value={form.timezone}
            onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Locale</span>
          <input
            className="w-full rounded-none border border-border bg-surface px-3 py-2"
            value={form.locale}
            onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Quote validity (days)</span>
          <input
            className="w-full rounded-none border border-border bg-surface px-3 py-2"
            type="number"
            min={1}
            max={365}
            value={form.quoteValidityDays ?? ""}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                quoteValidityDays: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Invoice payment terms (days)</span>
          <input
            className="w-full rounded-none border border-border bg-surface px-3 py-2"
            type="number"
            min={0}
            max={365}
            value={form.invoicePaymentTermDays ?? ""}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                invoicePaymentTermDays: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </SheetPadded>
  );
}
