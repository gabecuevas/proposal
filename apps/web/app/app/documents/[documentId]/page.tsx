"use client";

import { useEffect, useState } from "react";
import { CreatorDocumentEditor } from "@/components/documents/creator-document-editor";
import { FlowDocumentEditor } from "@/components/flow-document/flow-document-editor";
import { CommercialDocumentEditor } from "@/components/commercial/commercial-document-editor";
import {
  documentKindFromVariables,
  editorLayoutFromVariables,
  type EditorLayout,
  type WorkflowDocumentKind,
} from "@/lib/editor/document-kind";
import type { VariableContext } from "@/lib/editor/types";
import { isCommercialDocument } from "@/lib/commercial/schema";

type Params = {
  params: Promise<{ documentId: string }>;
};

/**
 * Routes to Flow, Creator, or Commercial (Quote/Invoice) full-screen editor.
 * Existing documents without a layout stay on Creator.
 */
export default function DocumentDetailPage({ params }: Params) {
  const [documentId, setDocumentId] = useState("");
  const [layout, setLayout] = useState<EditorLayout | null>(null);
  const [kind, setKind] = useState<WorkflowDocumentKind>("document");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const resolved = await params;
      if (!active) {
        return;
      }
      setDocumentId(resolved.documentId);
      try {
        const response = await fetch(`/api/documents/${resolved.documentId}`);
        if (!response.ok) {
          if (active) {
            setError("Document not found");
            setLayout("creator");
          }
          return;
        }
        const payload = (await response.json()) as {
          document?: { variables_json?: VariableContext; pricing_json?: unknown };
        };
        if (!active) {
          return;
        }
        const variables = payload.document?.variables_json;
        const docKind = documentKindFromVariables(variables);
        setKind(docKind);
        if (isCommercialDocument(payload.document?.pricing_json) || docKind === "quote" || docKind === "invoice") {
          setLayout("commercial");
        } else {
          setLayout(editorLayoutFromVariables(variables));
        }
      } catch {
        if (active) {
          setError("Could not load document");
          setLayout("creator");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params]);

  if (!documentId || !layout) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">{error || "Loading document…"}</p>
      </div>
    );
  }

  if (layout === "commercial") {
    return (
      <CommercialDocumentEditor
        documentId={documentId}
        type={kind === "invoice" ? "invoice" : "quote"}
      />
    );
  }

  if (layout === "flow") {
    return <FlowDocumentEditor documentId={documentId} />;
  }

  return <CreatorDocumentEditor documentId={documentId} />;
}
