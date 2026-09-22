"use client";

import "./flow-document-prototype.css";

import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  createFlowDocumentExtensions,
  FLOW_PAPER_PRESETS,
  type FlowPaperId,
} from "@/lib/flow-document/extensions";
import {
  FLOW_FIXTURE_LIST,
  FLOW_FIXTURES,
  type FlowFixtureId,
} from "@/lib/flow-document/fixtures";
import {
  countExplicitPageBreaks,
  parseFlowDoc,
  serializeFlowDoc,
} from "@/lib/flow-document/serialize";
import { measurePaginationPlusPageCount } from "@/lib/flow-document/measure-pages";

type Props = {
  className?: string;
};

/**
 * Phase 1A isolated Flow Document prototype.
 * State is in-memory only — not written to Document/Template tables.
 */
export function FlowDocumentPrototype({ className }: Props) {
  const [paper, setPaper] = useState<FlowPaperId>("letter");
  const [fixtureId, setFixtureId] = useState<FlowFixtureId>("short-agreement");
  const [jsonDraft, setJsonDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCountEstimate, setPageCountEstimate] = useState<number | null>(null);
  const [stressMs, setStressMs] = useState<number | null>(null);

  const extensions = useMemo(
    () => createFlowDocumentExtensions({ paper, pagination: true }),
    [paper],
  );

  const editor = useEditor(
    {
      extensions,
      content: FLOW_FIXTURES[fixtureId].doc,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "flow-document-editor prose prose-sm max-w-none focus:outline-none",
          "data-flow-document": "true",
        },
      },
      onUpdate: ({ editor: current }) => {
        setJsonDraft(serializeFlowDoc(current.getJSON()));
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    const fixture = FLOW_FIXTURES[fixtureId];
    const started = performance.now();
    editor.commands.setContent(fixture.doc);
    setJsonDraft(serializeFlowDoc(fixture.doc));
    setStatus(`Loaded fixture “${fixture.title}” (in-memory only).`);
    setError(null);
    if (fixtureId === "stress-50-pages") {
      setStressMs(Math.round(performance.now() - started));
    } else {
      setStressMs(null);
    }
  }, [editor, fixtureId]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const measure = () => {
      const widgetPages = measurePaginationPlusPageCount(editor.view.dom);
      if (widgetPages > 0) {
        setPageCountEstimate(widgetPages);
        return;
      }
      // Fallback only when PaginationPlus chrome has not mounted yet.
      const height = editor.view.dom.scrollHeight;
      const pageHeight = FLOW_PAPER_PRESETS[paper].size.pageHeight || 1056;
      setPageCountEstimate(Math.max(1, Math.ceil(height / pageHeight)));
    };
    measure();
    const id = window.setInterval(measure, 750);
    return () => window.clearInterval(id);
  }, [editor, paper, fixtureId]);

  const reloadFromJson = useCallback(() => {
    if (!editor) {
      return;
    }
    try {
      const doc = parseFlowDoc(jsonDraft);
      editor.commands.setContent(doc);
      setStatus(
        `Reloaded from JSON (${countExplicitPageBreaks(doc)} explicit page breaks). Still in-memory only.`,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [editor, jsonDraft]);

  const insertPageBreak = useCallback(() => {
    editor?.chain().focus().insertContent({ type: "pageBreak" }).run();
  }, [editor]);

  return (
    <div className={cn("flow-document-shell flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <p className="font-semibold">Flow Document Phase 1A prototype</p>
        <p className="mt-1 text-amber-900/90">
          Development-only. Edits are temporary (in-memory / local fixture JSON). Nothing is saved to
          Document or Template records. Pagination uses <code>tiptap-pagination-plus@2.1.0</code>{" "}
          (MIT, TipTap v2). Table-across-page splitting via TablePlus is{" "}
          <strong>not</strong> included in this package version — long tables are exercised but
          split behavior is unverified.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted">
          Fixture
          <select
            className="ml-2 rounded-md border border-border bg-white px-2 py-1 text-sm"
            value={fixtureId}
            onChange={(event) => setFixtureId(event.target.value as FlowFixtureId)}
          >
            {FLOW_FIXTURE_LIST.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Paper
          <select
            className="ml-2 rounded-md border border-border bg-white px-2 py-1 text-sm"
            value={paper}
            onChange={(event) => setPaper(event.target.value as FlowPaperId)}
          >
            {(Object.keys(FLOW_PAPER_PRESETS) as FlowPaperId[]).map((id) => (
              <option key={id} value={id}>
                {FLOW_PAPER_PRESETS[id].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-slate-50"
          onClick={insertPageBreak}
        >
          Insert page break
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-slate-50"
          onClick={reloadFromJson}
        >
          Reload from JSON
        </button>
        {pageCountEstimate != null ? (
          <span className="text-xs text-muted">
            PaginationPlus pages: {pageCountEstimate}
          </span>
        ) : null}
        {stressMs != null ? (
          <span className="text-xs text-muted">Stress setContent: {stressMs} ms</span>
        ) : null}
      </div>

      {status ? <p className="text-xs text-muted">{status}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flow-document-paper-frame min-h-[480px] overflow-auto rounded-lg border border-border bg-zinc-100 p-4">
          {editor ? <EditorContent editor={editor} /> : <p className="text-sm text-muted">Loading editor…</p>}
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-xs font-medium text-foreground">Serialized JSON (local)</p>
          <textarea
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            className="min-h-[320px] flex-1 rounded-md border border-border bg-white p-2 font-mono text-[11px] leading-snug text-foreground"
            spellCheck={false}
          />
          <p className="text-[11px] text-muted">{FLOW_FIXTURES[fixtureId].description}</p>
        </div>
      </div>
    </div>
  );
}
