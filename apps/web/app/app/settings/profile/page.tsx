"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SheetPadded } from "@/components/ui/sheet-table";

export default function SettingsProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [personalTimezone, setPersonalTimezone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          user?: { name?: string; email?: string; personalTimezone?: string | null };
        };
        setName(payload.user?.name ?? "");
        setEmail(payload.user?.email ?? "");
        setPersonalTimezone(
          payload.user?.personalTimezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone ??
            "America/Los_Angeles",
        );
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name, personalTimezone }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to save profile");
      return;
    }
    setMessage("Profile saved.");
  }

  return (
    <SheetPadded>
      <h1 className="text-sm font-semibold text-foreground">Profile</h1>
      <p className="mt-2 text-sm text-muted">Your account identity across SendDox workspaces.</p>
      <form className="mt-6 max-w-md space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Full name</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2"
            value={email}
            readOnly
          />
          <span className="mt-1 block text-xs text-muted">
            Email changes require a secure verification flow.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Personal time zone</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2"
            value={personalTimezone}
            onChange={(event) => setPersonalTimezone(event.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </SheetPadded>
  );
}
