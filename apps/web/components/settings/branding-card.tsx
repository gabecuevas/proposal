"use client";

import { useEffect, useState, type FormEvent } from "react";

const DEFAULT_BRAND = "#1e3a5f";

export function BrandingCard() {
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/workspace", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { workspace?: { brandColor?: string | null } };
        setBrandColor(payload.workspace?.brandColor || DEFAULT_BRAND);
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
      body: JSON.stringify({ brandColor }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to save branding");
      return;
    }
    const payload = (await response.json()) as { workspace?: { brandColor?: string | null } };
    setBrandColor(payload.workspace?.brandColor || DEFAULT_BRAND);
    setMessage("Branding saved.");
  }

  return (
    <section id="branding" className="scroll-mt-28 rounded-none border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">Branding</h2>
      <p className="mt-1 text-sm text-muted">
        Brand color for new documents. This does not change the SendDox product logo.
      </p>
      <form className="mt-4 max-w-md space-y-4" onSubmit={(event) => void onSubmit(event)}>
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
              onClick={() => setBrandColor(DEFAULT_BRAND)}
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
          {loading ? "Saving..." : "Save branding"}
        </button>
      </form>
    </section>
  );
}
