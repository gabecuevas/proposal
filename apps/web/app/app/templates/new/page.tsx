"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTemplatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");

  async function create() {
    setStatus("creating");
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled Template" }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const payload = (await response.json()) as { template: { id: string } };
    router.push(`/app/templates/${payload.template.id}`);
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Create Template</h1>
      <p className="text-sm text-muted">Start from a blank editor document and autosave JSON.</p>
      <button
        onClick={create}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        disabled={status === "creating"}
      >
        {status === "creating" ? "Creating..." : "Create template"}
      </button>
      {status === "error" ? <p className="text-sm text-red-400">Failed to create template.</p> : null}
    </main>
  );
}
