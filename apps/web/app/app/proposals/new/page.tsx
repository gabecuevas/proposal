"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewProposalPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Creating document…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setMessage("Could not create a document. Try again from Documents.");
        return;
      }
      const data = (await response.json()) as { document?: { id: string } };
      const id = data.document?.id;
      if (id) {
        router.replace(`/app/documents/${id}`);
        return;
      }
      setMessage("Unexpected response. Open Documents to continue.");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
      <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
