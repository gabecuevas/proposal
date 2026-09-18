"use client";

import { useEffect, useState } from "react";
import { CreatorDocumentEditor } from "@/components/documents/creator-document-editor";
import { FlowDocumentEditor } from "@/components/flow-document/flow-document-editor";
import { editorLayoutFromVariables, type EditorLayout } from "@/lib/editor/document-kind";
import type { VariableContext } from "@/lib/editor/types";

type Params = {
  params: Promise<{ documentId: string }>;
};

/**
 * Routes to Flow (Google Docs–style) or Creator based on variables_json.editor_layout.
 * Existing documents without a layout stay on Creator.
 */
export default function DocumentDetailPage({ params }: Params) {
  const [documentId, setDocumentId] = useState("");
  const [layout, setLayout] = useState<EditorLayout | null>(null);
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
          document?: { variables_json?: VariableContext };
        };
        if (!active) {
          return;
        }
        setLayout(editorLayoutFromVariables(payload.document?.variables_json));
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

  if (layout === "flow") {
    return <FlowDocumentEditor documentId={documentId} />;
  }

  return <CreatorDocumentEditor documentId={documentId} />;
}
