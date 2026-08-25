"use client";

import { useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignerRecipientProvider } from "@/components/editor/signer-field-context";
import { PricingProvider } from "@/components/editor/pricing-context";
import { CreatorCanvas } from "@/components/editor/creator/creator-canvas";
import { CreatorFieldsSidebar } from "@/components/editor/creator/creator-fields-sidebar";
import { CreatorHeader } from "@/components/editor/creator/creator-header";
import { CreatorPageStrip } from "@/components/editor/creator/creator-page-strip";
import { defaultEditorDoc } from "@/lib/editor/defaults";
import { creatorEditorProps } from "@/lib/editor/editor-config";
import { editorExtensions } from "@/lib/editor/extensions";
import { insertPageBreak } from "@/lib/editor/insert-elements";
import { insertSignerFieldAtPoint, insertSignerFieldBlock } from "@/lib/editor/insert-signer-field";
import { migrateSignerFieldsDoc } from "@/lib/editor/migrate-signer-fields";
import { pageSizeFromDoc, pageSizeSpec, withPageSize, type PageSizeId } from "@/lib/editor/page-geometry";
import { openPrintPreview } from "@/lib/editor/print-document";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import { renderComputedHtml } from "@/lib/editor/render";
import { SaveQueue } from "@/lib/editor/save-queue";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { serializeStable } from "@/lib/editor/stable";
import { resolveTemplateVariables } from "@/lib/editor/variables";
import type { EditorNode, EditorDoc, PricingModel, VariableContext, VariableRegistry } from "@/lib/editor/types";
import { pageCountFromEditor } from "@/lib/ui/template-meta";

type ContentBlockSummary = {
  id: string;
  name: string;
  version: number;
};

type Props = {
  templateId: string;
  initialName: string;
  initialDoc: EditorDoc;
  initialVariableRegistry: VariableRegistry;
  initialPricing: PricingModel;
  contentBlocks: ContentBlockSummary[];
};

const defaultRecipients = [
  { id: "recipient-primary", name: "Primary Signer", email: "you@company.com" },
  { id: "recipient-finance", name: "Finance Signer", email: "finance@company.com" },
];

function parseJsonText<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function TemplateEditor({
  templateId,
  initialName,
  initialDoc,
  initialVariableRegistry,
  initialPricing,
  contentBlocks,
}: Props) {
  const router = useRouter();
  const migratedInitial = useMemo(
    () => migrateSignerFieldsDoc(initialDoc ?? defaultEditorDoc),
    [initialDoc],
  );

  const [status, setStatus] = useState("Idle");
  const [name, setName] = useState(initialName);
  const [serialized, setSerialized] = useState(() =>
    serializeStable(withPageSize(migratedInitial, pageSizeFromDoc(migratedInitial))),
  );
  const [lastSavedSerialized, setLastSavedSerialized] = useState(() =>
    serializeStable(withPageSize(migratedInitial, pageSizeFromDoc(migratedInitial))),
  );
  const [registryText, setRegistryText] = useState(() => JSON.stringify(initialVariableRegistry, null, 2));
  const [variablesText, setVariablesText] = useState(
    '{\n  "client": { "name": "Acme Corp", "company": "Acme Corp" },\n  "deal": { "value": 12000 }\n}',
  );
  const [pricing, setPricing] = useState<PricingModel>(initialPricing);
  const [selectedVariable, setSelectedVariable] = useState(Object.keys(initialVariableRegistry)[0] ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState(contentBlocks[0]?.id ?? "");
  const [availableBlocks, setAvailableBlocks] = useState(contentBlocks);
  const [selectedRecipientId, setSelectedRecipientId] = useState(defaultRecipients[0]?.id ?? "");
  const [mode, setMode] = useState<"sender-preview" | "recipient-fill" | "finalized">("sender-preview");
  const [debugOpen, setDebugOpen] = useState(false);
  const [visualPages, setVisualPages] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeId>(() => pageSizeFromDoc(migratedInitial));
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const saveQueueRef = useRef(new SaveQueue());
  const lastSavedSerializedRef = useRef(lastSavedSerialized);
  lastSavedSerializedRef.current = lastSavedSerialized;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: migratedInitial,
    editorProps: creatorEditorProps,
    onUpdate({ editor: nextEditor }) {
      setSerialized(serializeStable(withPageSize(nextEditor.getJSON() as EditorDoc, pageSizeRef.current)));
    },
  });

  const variableRegistry = parseJsonText<VariableRegistry>(registryText, initialVariableRegistry);
  const variableContext = parseJsonText<VariableContext>(variablesText, {});
  const variableOutput = resolveTemplateVariables(variableRegistry, variableContext);
  const quoteTotals = calculateQuoteTotals(pricing);
  const pageCount = Math.max(pageCountFromEditor(JSON.parse(serialized) as EditorDoc), visualPages);

  function buildComputedHtml() {
    return renderComputedHtml({
      doc: JSON.parse(serialized) as EditorDoc,
      mode,
      resolvedVariables: variableOutput.resolved,
      pricing,
      signerFieldValues: [],
      activeRecipientId: selectedRecipientId,
    });
  }

  const saveNow = useCallback(async () => {
    await saveQueueRef.current.run(async () => {
      try {
        setStatus("Saving...");
        const response = await fetch(`/api/templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            editor_json: JSON.parse(serialized) as EditorDoc,
            variable_registry: variableRegistry,
            pricing_json: pricing,
          }),
        });
        if (!response.ok) {
          setStatus("Save failed");
          return;
        }
        lastSavedSerializedRef.current = serialized;
        setLastSavedSerialized(serialized);
        setStatus("Saved");
      } catch {
        setStatus("Save failed");
      }
    });
  }, [name, pricing, serialized, templateId, variableRegistry]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    setSerialized(serializeStable(withPageSize(editor.getJSON() as EditorDoc, pageSize)));
  }, [editor, pageSize]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const id = window.setInterval(() => {
      if (serialized === lastSavedSerialized) {
        return;
      }
      void saveNow();
    }, 1200);

    return () => window.clearInterval(id);
  }, [editor, lastSavedSerialized, saveNow, serialized]);

  useEffect(() => {
    function flushIfDirty() {
      if (serialized === lastSavedSerializedRef.current) {
        return;
      }
      void fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          editor_json: JSON.parse(serialized) as EditorDoc,
          variable_registry: variableRegistry,
          pricing_json: pricing,
        }),
        keepalive: true,
      });
    }
    window.addEventListener("pagehide", flushIfDirty);
    return () => window.removeEventListener("pagehide", flushIfDirty);
  }, [name, pricing, serialized, templateId, variableRegistry]);

  const currentBlock = availableBlocks.find((block) => block.id === selectedBlockId);

  function insertVariableToken() {
    if (!editor || !selectedVariable) {
      return;
    }
    editor.chain().focus().insertContent({ type: "variableToken", attrs: { key: selectedVariable } }).run();
  }

  function insertContentBlockEmbed() {
    if (!editor || !currentBlock) {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "contentBlockEmbed",
        attrs: { blockId: currentBlock.id, version: currentBlock.version },
      })
      .run();
  }

  async function bumpSelectedBlockVersion() {
    if (!currentBlock || !editor) {
      return;
    }

    const response = await fetch(`/api/content-blocks/${currentBlock.id}/version`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editor_json: JSON.parse(serialized) as EditorDoc }),
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      block: { id: string; name: string; version: number };
    };

    setAvailableBlocks((current) =>
      current.map((item) =>
        item.id === payload.block.id ? { ...item, version: payload.block.version } : item,
      ),
    );

    const updateNodeVersion = (node: EditorNode): EditorNode => {
      if (node.type === "contentBlockEmbed" && node.attrs?.blockId === payload.block.id) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            version: payload.block.version,
          },
        };
      }

      return {
        ...node,
        content: node.content?.map(updateNodeVersion),
      };
    };

    const currentDoc = JSON.parse(serialized) as EditorDoc;
    const nextDoc: EditorDoc = {
      type: "doc",
      content: currentDoc.content.map(updateNodeVersion),
    };
    editor.commands.setContent(nextDoc);
  }

  function insertQuoteTable() {
    if (!editor) {
      return;
    }
    editor.chain().focus().insertContent({ type: "quoteTable", attrs: { tableId: "default" } }).run();
  }

  function insertSignerField(type: SignerFieldEditorType) {
    if (!editor || !selectedRecipientId) {
      return;
    }
    insertSignerFieldBlock(editor, { recipientId: selectedRecipientId, type });
  }

  async function duplicateTemplate() {
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${name} (copy)`,
        editor_json: JSON.parse(serialized) as EditorDoc,
        tags: ["copy"],
      }),
    });
    if (!response.ok) {
      setStatus("Could not duplicate template");
      return;
    }
    const payload = (await response.json()) as { template: { id: string } };
    router.push(`/app/templates/${payload.template.id}`);
  }

  return (
    <SignerRecipientProvider recipients={defaultRecipients}>
      <PricingProvider pricing={pricing}>
      <div className="flex h-screen w-full flex-col bg-background">
        <CreatorHeader
          name={name}
          onNameChange={setName}
          saveStatus={status}
          closeHref="/app/templates"
          editor={editor}
          pageSize={pageSize}
          onPageSizeChange={(size: PageSizeId) => {
            setPageSize(size);
            editor?.commands.setPageSize(size);
          }}
          onSave={() => void saveNow()}
          onPrint={() => openPrintPreview(buildComputedHtml(), pageSize)}
          onInsertField={insertSignerField}
          variableKeys={Object.keys(variableRegistry)}
          fileItems={[{ label: "Make a copy", onClick: () => void duplicateTemplate() }]}
          primaryActionLabel="Save template"
          onPrimaryAction={() => void saveNow()}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <CreatorPageStrip
              name={name}
              pageCount={pageCount}
              currentPage={1}
              pageSizeLabel={pageSizeSpec(pageSize).shortLabel}
              onAddPage={() => editor && insertPageBreak(editor)}
            />

            <CreatorCanvas
              editor={editor}
              pageSize={pageSize}
              templateId={templateId}
              onPageCountChange={setVisualPages}
              onDropField={(type, clientX, clientY) => {
                if (!editor || !selectedRecipientId) {
                  return;
                }
                insertSignerFieldAtPoint(editor, {
                  recipientId: selectedRecipientId,
                  type: type as SignerFieldEditorType,
                  clientX,
                  clientY,
                });
              }}
            />
          </div>

          <CreatorFieldsSidebar
            editor={editor}
            recipients={defaultRecipients}
            selectedRecipientId={selectedRecipientId}
            onSelectRecipient={setSelectedRecipientId}
            onInsertField={insertSignerField}
            missingVariableCount={variableOutput.missing.length}
            unassignedRoleCount={0}
          />
        </div>

        <details
          className="shrink-0 border-t border-border bg-surface"
          onToggle={(event) => setDebugOpen((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted hover:text-foreground">
            Advanced workspace tools
          </summary>
          <div className="grid max-h-72 gap-3 overflow-auto p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Variables</p>
              <select
                className="w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                value={selectedVariable}
                onChange={(event) => setSelectedVariable(event.target.value)}
              >
                {Object.keys(variableRegistry).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={insertVariableToken}
                className="mt-2 w-full rounded border border-border px-3 py-1 text-sm hover:bg-surface"
              >
                Insert variable token
              </button>
              <p className="mt-3 mb-1 text-xs uppercase text-muted">Content blocks</p>
              <select
                className="w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                value={selectedBlockId}
                onChange={(event) => setSelectedBlockId(event.target.value)}
              >
                {availableBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name} v{block.version}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={insertContentBlockEmbed}
                className="mt-2 w-full rounded border border-border px-3 py-1 text-sm hover:bg-surface"
              >
                Insert content block
              </button>
              <button
                type="button"
                onClick={bumpSelectedBlockVersion}
                className="mt-1 w-full rounded border border-border px-3 py-1 text-sm hover:bg-surface"
              >
                Publish new block version
              </button>
              <button
                type="button"
                onClick={insertQuoteTable}
                className="mt-1 w-full rounded border border-border px-3 py-1 text-sm hover:bg-surface"
              >
                Insert quote table
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().insertContent({ type: "pageBreak" }).run()}
                className="mt-1 w-full rounded border border-border px-3 py-1 text-sm hover:bg-surface"
              >
                Insert page break
              </button>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Variable registry</p>
              <textarea
                className="h-36 w-full rounded border border-border bg-surface p-2 text-xs"
                value={registryText}
                onChange={(event) => setRegistryText(event.target.value)}
              />
              <p className="mt-2 text-xs text-muted">
                Missing required: {variableOutput.missing.length ? variableOutput.missing.join(", ") : "none"}
              </p>
              <p className="mt-3 mb-1 text-xs uppercase text-muted">Variable context</p>
              <textarea
                className="h-28 w-full rounded border border-border bg-surface p-2 text-xs"
                value={variablesText}
                onChange={(event) => setVariablesText(event.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Quote</p>
              <label className="mb-2 block text-xs text-muted">
                Currency
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  value={pricing.currency}
                  onChange={(event) => setPricing((current) => ({ ...current, currency: event.target.value }))}
                />
              </label>
              <label className="mb-2 block text-xs text-muted">
                Discount %
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  type="number"
                  value={pricing.discountPercent ?? 0}
                  onChange={(event) =>
                    setPricing((current) => ({ ...current, discountPercent: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="mb-2 block text-xs text-muted">
                Tax %
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  type="number"
                  value={pricing.taxPercent ?? 0}
                  onChange={(event) =>
                    setPricing((current) => ({ ...current, taxPercent: Number(event.target.value) }))
                  }
                />
              </label>
              <button
                onClick={() =>
                  setPricing((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      {
                        id: `item-${crypto.randomUUID()}`,
                        name: "Line Item",
                        quantity: 1,
                        unitPrice: 100,
                      },
                    ],
                  }))
                }
                className="mb-3 w-full rounded border border-border px-2 py-1 text-xs hover:bg-surface"
              >
                Add line item
              </button>
              <div className="space-y-2">
                {pricing.items.map((item, index) => (
                  <div key={item.id} className="rounded border border-border p-2">
                    <input
                      className="mb-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                      value={item.name}
                      onChange={(event) =>
                        setPricing((current) => {
                          const items = current.items.map((lineItem, lineIndex) =>
                            lineIndex === index ? { ...lineItem, name: event.target.value } : lineItem,
                          );
                          return { ...current, items };
                        })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          setPricing((current) => {
                            const items = current.items.map((lineItem, lineIndex) =>
                              lineIndex === index
                                ? { ...lineItem, quantity: Number(event.target.value) }
                                : lineItem,
                            );
                            return { ...current, items };
                          })
                        }
                      />
                      <input
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                        type="number"
                        value={item.unitPrice}
                        onChange={(event) =>
                          setPricing((current) => {
                            const items = current.items.map((lineItem, lineIndex) =>
                              lineIndex === index
                                ? { ...lineItem, unitPrice: Number(event.target.value) }
                                : lineItem,
                            );
                            return { ...current, items };
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Total due now: {quoteTotals.totalDueNow.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase text-muted">Render preview</p>
                <select
                  className="rounded border border-border bg-surface px-2 py-1 text-xs"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as typeof mode)}
                >
                  <option value="sender-preview">sender-preview</option>
                  <option value="recipient-fill">recipient-fill</option>
                  <option value="finalized">finalized</option>
                </select>
              </div>
              <div
                className="prose max-h-40 overflow-auto rounded border border-border bg-surface p-2 text-xs"
                dangerouslySetInnerHTML={{ __html: debugOpen ? buildComputedHtml() : "" }}
              />
            </div>
          </div>
        </details>
      </div>
      </PricingProvider>
    </SignerRecipientProvider>
  );
}
