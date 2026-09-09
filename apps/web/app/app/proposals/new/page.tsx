"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNewDocumentWorkflow } from "@/components/documents/new-document-workflow-context";

/**
 * Legacy route: opens the New Document workflow slide-over, then returns to Documents.
 */
export default function NewProposalPage() {
  const router = useRouter();
  const { openWorkflow } = useNewDocumentWorkflow();

  useEffect(() => {
    openWorkflow();
    router.replace("/app/documents");
  }, [openWorkflow, router]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-background">
      <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
      <p className="text-sm text-muted">Opening new document workflow…</p>
    </div>
  );
}
