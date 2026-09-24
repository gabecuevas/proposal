"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SheetPadded } from "@/components/ui/sheet-table";

const DEFAULT_BRAND = "#1e3a5f";

export default function SettingsBrandingPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoAssetKey, setLogoAssetKey] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND);
  const [updatedAt, setUpdatedAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/workspace", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          workspace?: {
            logoUrl?: string | null;
            logoAssetKey?: string | null;
            brandColor?: string | null;
            updatedAt?: string;
          };
        };
        setLogoUrl(payload.workspace?.logoUrl ?? null);
        setLogoAssetKey(payload.workspace?.logoAssetKey ?? null);
        setBrandColor(payload.workspace?.brandColor || DEFAULT_BRAND);
        setUpdatedAt(payload.workspace?.updatedAt ?? "");
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
        brandColor,
        logoAssetKey,
        expectedUpdatedAt: updatedAt || undefined,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to save branding");
      return;
    }
    const payload = (await response.json()) as {
      workspace?: {
        logoUrl?: string | null;
        logoAssetKey?: string | null;
        brandColor?: string | null;
        updatedAt?: string;
      };
    };
    setLogoUrl(payload.workspace?.logoUrl ?? null);
    setLogoAssetKey(payload.workspace?.logoAssetKey ?? null);
    setBrandColor(payload.workspace?.brandColor || DEFAULT_BRAND);
    setUpdatedAt(payload.workspace?.updatedAt ?? "");
    setMessage("Branding saved.");
  }

  function restoreDefault() {
    setBrandColor(DEFAULT_BRAND);
  }

  function removeLogo() {
    setLogoAssetKey(null);
    setLogoUrl(null);
  }

  return (
    <SheetPadded>
      <h1 className="text-sm font-semibold text-foreground">Branding</h1>
      <p className="mt-2 text-sm text-muted">
        Company logo and brand color for new documents. This does not change the SendDox product logo.
      </p>
      <form className="mt-6 max-w-md space-y-5" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <p className="mb-2 text-sm text-muted">Company logo</p>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-none border border-border bg-slate-50 text-sm font-semibold text-muted">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
              ) : (
                "—"
              )}
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted">PNG, JPEG or WebP. Max 2MB. Manage upload from company settings.</p>
              {logoAssetKey ? (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="text-red-600 underline-offset-2 hover:underline"
                >
                  Remove logo
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Brand color</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-border bg-surface"
            />
            <input
              className="flex-1 rounded-none border border-border bg-surface px-3 py-2 font-mono text-sm"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
              pattern="^#[0-9A-Fa-f]{6}$"
              required
            />
            <button
              type="button"
              onClick={restoreDefault}
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              Restore default
            </button>
          </div>
        </label>
        <div
          className="rounded-none border border-border p-4 text-sm"
          style={{ borderLeftWidth: 4, borderLeftColor: brandColor }}
        >
          Preview: new documents can use this accent for headers and buttons.
        </div>
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
