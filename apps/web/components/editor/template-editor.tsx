"use client";

import { useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignerRecipientProvider } from "@/components/editor/signer-field-context";
import { PricingProvider } from "@/components/editor/pricing-context";
import { CreatorCanvas } from "@/components/editor/creator/creator-canvas";
import { CreatorFieldsSidebar } from "@/components/editor/creator/creator-fields-sidebar";
import { CreatorHeader } from "@/components/editor/creator/creator-header";
import { CreatorPageWorkspace } from "@/components/editor/creator/creator-page-workspace";
import { defaultEditorDoc } from "@/lib/editor/defaults";
import { creatorEditorProps } from "@/lib/editor/editor-config";
import { editorExtensions } from "@/lib/editor/extensions";
import { insertPageBreak } from "@/lib/editor/insert-elements";
import { insertSignerFieldAtPoint, insertSignerFieldBlock } from "@/lib/editor/insert-signer-field";
import { migrateSignerFieldsDoc } from "@/lib/editor/migrate-signer-fields";
import { pageSizeFromDoc, withPageSize, type PageSizeId } from "@/lib/editor/page-geometry";
import { openPrintPreview } from "@/lib/editor/print-document";
import { AUTOSAVE_DELAY_MS } from "@/lib/editor/autosave";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import { renderComputedHtml } from "@/lib/editor/render";
import { SaveQueue } from "@/lib/editor/save-queue";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { serializeStable } from "@/lib/editor/stable";
import { resolveTemplateVariables } from "@/lib/editor/variables";
import type { EditorNode, EditorDoc, PricingModel, VariableContext, VariableRegistry } from "@/lib/editor/types";
import { pageCountFromEditor } from "@/lib/ui/template-meta";
import { applyTitleToDoc } from "@/lib/ui/document-title";

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
  { id: "sender-self", name: "You", email: "", role: "sender" as const },
  { id: "recipient-primary", name: "Primary Signer", email: "you@company.com", role: "signer" as const },
  { id: "recipient-finance", name: "Finance Signer", email: "finance@company.com", role: "signer" as const },
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
  const [lastSavedName, setLastSavedName] = useState(initialName);
  const [registryText, setRegistryText] = useState(() => JSON.stringify(initialVariableRegistry, null, 2));
  const [variablesText, setVariablesText] = useState(
    '{\n  "client": { "name": "Acme Corp", "company": "Acme Corp" },\n  "deal": { "value": 12000 }\n}',
  );
  const [pricing, setPricing] = useState<PricingModel>(initialPricing);
  const [selectedVariable, setSelectedVariable] = useState(Object.keys(initialVariableRegistry)[0] ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState(contentBlocks[0]?.id ?? "");
  const [availableBlocks, setAvailableBlocks] = useState(contentBlocks);
  const [selectedRecipientId, setSelectedRecipientId] = useState("recipient-primary");
  const [mode, setMode] = useState<"sender-preview" | "recipient-fill" | "finalized">("sender-preview");
  const [debugOpen, setDebugOpen] = useState(false);
  const [visualPages, setVisualPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeId>(() => pageSizeFromDoc(migratedInitial));
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const saveQueueRef = useRef(new SaveQueue());
  const lastSavedSerializedRef = useRef(lastSavedSerialized);
  lastSavedSerializedRef.current = lastSavedSerialized;
  const lastSavedNameRef = useRef(lastSavedName);
  lastSavedNameRef.current = lastSavedName;
  const nameRef = useRef(name);
  nameRef.current = name;
  const serializedRef = useRef(serialized);
  serializedRef.current = serialized;
  const pricingRef = useRef(pricing);
  pricingRef.current = pricing;
  const registryTextRef = useRef(registryText);
  registryTextRef.current = registryText;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: migratedInitial,
    editorProps: creatorEditorProps,
    onUpdate({ editor: nextEditor }) {
      setSerialized(serializeStable(withPageSize(nextEditor.getJSON() as EditorDoc, pageSizeRef.current)));
    },
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

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
        editorRef.current?.commands.refreshPageFlow();
        const liveDoc = editorRef.current
          ? serializeStable(withPageSize(editorRef.current.getJSON() as EditorDoc, pageSizeRef.current))
          : serializedRef.current;
        if (liveDoc !== serializedRef.current) {
          setSerialized(liveDoc);
        }
        const liveName = nameRef.current.trim() || "Untitled template";
        const liveRegistry = parseJsonText<VariableRegistry>(registryTextRef.current, initialVariableRegistry);
        const editorDoc = applyTitleToDoc(JSON.parse(liveDoc) as EditorDoc, liveName);
        const persisted = serializeStable(withPageSize(editorDoc, pageSizeRef.current));
        const response = await fetch(`/api/templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: liveName,
            editor_json: editorDoc,
            variable_registry: liveRegistry,
            pricing_json: pricingRef.current,
          }),
        });
        if (!response.ok) {
          setStatus("Save failed");
          return;
        }
        lastSavedSerializedRef.current = persisted;
        lastSavedNameRef.current = liveName;
        setSerialized(persisted);
        setLastSavedSerialized(persisted);
        setLastSavedName(liveName);
        if (liveDoc !== persisted && editorRef.current) {
          editorRef.current.commands.setContent(editorDoc);
        }
        setStatus("Saved");
      } catch {
        setStatus("Save failed");
      }
    });
  }, [initialVariableRegistry, templateId]);

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
    if (serialized === lastSavedSerialized && name === lastSavedName) {
      return;
    }
    const id = window.setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [editor, lastSavedName, lastSavedSerialized, name, saveNow, serialized]);

  useEffect(() => {
    function flushIfDirty() {
      if (serialized === lastSavedSerializedRef.current && name === lastSavedNameRef.current) {
        return;
      }
      void fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameRef.current.trim() || "Untitled template",
          editor_json: applyTitleToDoc(JSON.parse(serialized) as EditorDoc, nameRef.current),
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

  async function saveAs(nextName: string) {
    const trimmed = nextName.trim() || "Untitled template";
    setName(trimmed);
    nameRef.current = trimmed;
    if (editor) {
      editor.commands.setContent(applyTitleToDoc(editor.getJSON() as EditorDoc, trimmed));
    }
    await saveNow();
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
          onSaveAs={(nextName) => saveAs(nextName)}
          saveAsKind="template"
          onPrint={() => openPrintPreview(buildComputedHtml(), pageSize)}
          onInsertField={insertSignerField}
          variableKeys={Object.keys(variableRegistry)}
          fileItems={[{ label: "Make a copy", onClick: () => void duplicateTemplate() }]}
          primaryActionLabel="Save template"
          primaryActionShowsSendIcon={false}
          onPrimaryAction={() => void saveNow()}
        />

        <div className="flex min-h-0 min-w-0 flex-1">
          <CreatorPageWorkspace
            editor={editor}
            name={name}
            pageCount={pageCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onAddPage={() => editor && insertPageBreak(editor)}
          >
            <CreatorCanvas
              editor={editor}
              pageSize={pageSize}
              templateId={templateId}
              documentName={name}
              onPageCountChange={setVisualPages}
              onVisiblePageChange={setCurrentPage}
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
          </CreatorPageWorkspace>

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
