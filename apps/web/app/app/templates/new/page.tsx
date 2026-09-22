"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId");
  const autoCreate = searchParams.get("auto") === "1";
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const autoStarted = useRef(false);

  async function create() {
    setStatus("creating");
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled Template",
        folder_id: folderId || null,
      }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const payload = (await response.json()) as { template: { id: string } };
    router.replace(`/app/templates/${payload.template.id}`);
  }

  useEffect(() => {
    if (!autoCreate || autoStarted.current) {
      return;
    }
    autoStarted.current = true;
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when auto=1
  }, [autoCreate]);

  if (autoCreate) {
    return (
      <main className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
        <p className="text-sm text-muted">
          {status === "error" ? "Failed to create template." : "Creating template…"}
        </p>
        {status === "error" ? (
          <button
            type="button"
            onClick={() => void create()}
            className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
          >
            Try again
          </button>
        ) : null}
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Create Template</h1>
      <p className="text-sm text-muted">Start from a blank editor document and autosave JSON.</p>
      <button
        onClick={() => void create()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        disabled={status === "creating"}
      >
        {status === "creating" ? "Creating..." : "Create template"}
      </button>
      {status === "error" ? <p className="text-sm text-red-400">Failed to create template.</p> : null}
    </main>
  );
}
