"use client";

import { useEffect, useState } from "react";
import { crmInputClass } from "@/components/crm/variable-pills";

export function WorkspaceNameCard() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/workspace");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { workspace?: { name?: string } };
      if (!cancelled) {
        setName(payload.workspace?.name ?? "");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setStatus("");
    setError("");
    const response = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError("Failed to save workspace name");
      return;
    }
    setStatus("Workspace name saved.");
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">Workspace</h2>
      <p className="mt-1 text-sm text-muted">This name appears on documents and in your workspace.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className={`max-w-md flex-1 ${crmInputClass()}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Workspace name"
        />
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Save
        </button>
      </div>
      {status ? <p className="mt-2 text-sm text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
