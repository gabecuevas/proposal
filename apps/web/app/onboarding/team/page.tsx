"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { OnboardingProgress } from "@/components/auth/onboarding-progress";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

type InviteRow = { email: string; role: "ADMIN" | "MEMBER" };

export default function OnboardingTeamPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InviteRow[]>([{ email: "", role: "MEMBER" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateRow(index: number, patch: Partial<InviteRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submitInvites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const invites = rows.filter((row) => row.email.trim());
    const response = await fetch("/api/onboarding/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ invites }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to send invites");
      setLoading(false);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  async function skip() {
    setLoading(true);
    const response = await fetch("/api/onboarding/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ skip: true }),
    });
    setLoading(false);
    if (response.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <OnboardingProgress active="Team" className="mb-6" />
      <h1 className="text-3xl font-semibold">Invite your team</h1>
      <p className="mt-2 text-sm text-muted">Add teammates now or skip and invite later from Settings.</p>
      <form className="mt-8 space-y-4" onSubmit={submitInvites}>
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-none border border-border bg-surface px-4 py-3 text-sm"
              placeholder="colleague@company.com"
              type="email"
              value={row.email}
              onChange={(event) => updateRow(index, { email: event.target.value })}
            />
            <select
              className="rounded-none border border-border bg-surface px-3 py-3 text-sm"
              value={row.role}
              onChange={(event) => updateRow(index, { role: event.target.value as InviteRow["role"] })}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-medium text-primary"
          onClick={() => setRows((current) => [...current, { email: "", role: "MEMBER" }])}
        >
          + Add another
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send invites & finish"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void skip()}
          className="w-full rounded-none border border-border px-4 py-3 text-sm font-medium hover:bg-surface disabled:opacity-60"
        >
          Skip for now
        </button>
      </form>
    </main>
  );
}
