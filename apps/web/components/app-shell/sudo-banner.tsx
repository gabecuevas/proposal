"use client";

import { useState } from "react";

export type SudoBannerInfo = {
  targetEmail: string;
  adminEmail: string;
  expiresAt: string;
};

export function SudoBanner({ sudo }: { sudo: SudoBannerInfo }) {
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    const res = await fetch("/api/admin/sudo/end", { method: "POST" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { redirectHint?: string } | null;
    window.location.assign(data?.redirectHint ?? "/login");
  }

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950"
    >
      <span>
        Sudo: acting as <strong>{sudo.targetEmail}</strong>. Changes are saved as this user and
        audited to {sudo.adminEmail}. Ends at{" "}
        {new Date(sudo.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
      </span>
      <button
        type="button"
        onClick={() => void exit()}
        disabled={exiting}
        className="ml-auto rounded-none border border-slate-950 bg-white px-3 py-1 text-xs font-semibold disabled:opacity-60"
      >
        {exiting ? "Exiting…" : "Exit sudo"}
      </button>
    </div>
  );
}
