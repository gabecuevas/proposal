"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { defaultEditorDoc } from "@/lib/editor/defaults";
import { editorExtensions } from "@/lib/editor/extensions";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import { renderComputedHtml } from "@/lib/editor/render";
import { serializeStable } from "@/lib/editor/stable";
import { resolveTemplateVariables } from "@/lib/editor/variables";
import type {
  EditorNode,
  EditorDoc,
  PricingModel,
  SignerFieldValue,
  VariableContext,
  VariableRegistry,
} from "@/lib/editor/types";

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
  { id: "recipient-primary", name: "Primary Signer" },
  { id: "recipient-finance", name: "Finance Signer" },
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
  const [status, setStatus] = useState("Idle");
  const [name, setName] = useState(initialName);
  const [serialized, setSerialized] = useState(() => serializeStable(initialDoc));
  const [lastSavedSerialized, setLastSavedSerialized] = useState(() => serializeStable(initialDoc));
  const [registryText, setRegistryText] = useState(() => JSON.stringify(initialVariableRegistry, null, 2));
  const [variablesText, setVariablesText] = useState(
    '{\n  "client": { "name": "Acme Corp", "company": "Acme Corp" },\n  "deal": { "value": 12000 }\n}',
  );
  const [pricing, setPricing] = useState<PricingModel>(initialPricing);
  const [selectedVariable, setSelectedVariable] = useState(Object.keys(initialVariableRegistry)[0] ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState(contentBlocks[0]?.id ?? "");
  const [availableBlocks, setAvailableBlocks] = useState(contentBlocks);
  const [selectedRecipientId, setSelectedRecipientId] = useState(defaultRecipients[0]?.id ?? "");
  const [selectedSignerType, setSelectedSignerType] = useState<
    "signature" | "initial" | "date" | "text" | "checkbox"
  >("signature");
  const [mode, setMode] = useState<"sender-preview" | "recipient-fill" | "finalized">("sender-preview");
  const [signerValues, setSignerValues] = useState<SignerFieldValue[]>([]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialDoc ?? defaultEditorDoc,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert min-h-[480px] max-w-none rounded-xl border border-border bg-surface p-6 focus:outline-none",
      },
    },
    onUpdate({ editor: nextEditor }) {
      setSerialized(serializeStable(nextEditor.getJSON() as EditorDoc));
    },
  });

  const variableRegistry = parseJsonText<VariableRegistry>(registryText, initialVariableRegistry);
  const variableContext = parseJsonText<VariableContext>(variablesText, {});
  const variableOutput = resolveTemplateVariables(variableRegistry, variableContext);
  const quoteTotals = calculateQuoteTotals(pricing);
  const computedHtml = renderComputedHtml({
    doc: JSON.parse(serialized) as EditorDoc,
    mode,
    resolvedVariables: variableOutput.resolved,
    pricing,
    signerFieldValues: signerValues,
    activeRecipientId: selectedRecipientId,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const id = window.setInterval(async () => {
      if (serialized === lastSavedSerialized) {
        return;
      }

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

      setLastSavedSerialized(serialized);
      setStatus("Saved");
    }, 1200);

    return () => window.clearInterval(id);
  }, [editor, lastSavedSerialized, name, pricing, serialized, templateId, variableRegistry]);

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

  function insertSignerField() {
    if (!editor || !selectedRecipientId) {
      return;
    }

    const fieldId = `field-${crypto.randomUUID()}`;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "signerField",
        attrs: {
          fieldId,
          recipientId: selectedRecipientId,
          type: selectedSignerType,
          required: true,
        },
      })
      .run();

    setSignerValues((existing) => [
      ...existing,
      {
        fieldId,
        recipientId: selectedRecipientId,
        type: selectedSignerType,
        required: true,
        value: "",
      },
    ]);
  }

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="grid gap-2 rounded-lg border border-border bg-surface p-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted">Variables</p>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
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
              onClick={insertVariableToken}
              className="w-full rounded border border-border px-3 py-1 text-sm hover:bg-background"
            >
              Insert variable token
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted">Content Blocks</p>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
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
              onClick={insertContentBlockEmbed}
              className="w-full rounded border border-border px-3 py-1 text-sm hover:bg-background"
            >
              Insert content block
            </button>
            <button
              onClick={bumpSelectedBlockVersion}
              className="w-full rounded border border-border px-3 py-1 text-sm hover:bg-background"
            >
              Publish new block version
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted">Quote</p>
            <button
              onClick={insertQuoteTable}
              className="w-full rounded border border-border px-3 py-1 text-sm hover:bg-background"
            >
              Insert quote table
            </button>
            <button
              onClick={() => editor?.chain().focus().insertContent({ type: "pageBreak" }).run()}
              className="w-full rounded border border-border px-3 py-1 text-sm hover:bg-background"
            >
              Insert page break
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted">Signer Field</p>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedRecipientId}
              onChange={(event) => setSelectedRecipientId(event.target.value)}
            >
              {defaultRecipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedSignerType}
              onChange={(event) =>
                setSelectedSignerType(event.target.value as typeof selectedSignerType)
              }
            >
              <option value="signature">signature</option>
              <option value="initial">initial</option>
              <option value="date">date</option>
              <option value="text">text</option>
              <option value="checkbox">checkbox</option>
            </select>
            <button
              onClick={insertSignerField}
              className="w-full rounded border border-border px-3 py-1 text-sm hover:bg-background"
            >
              Insert signer field
            </button>
          </div>
        </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Template name"
        />
        <span className="ml-4 text-xs text-muted">{status}</span>
      </div>
        <EditorContent editor={editor} />
        <pre className="overflow-auto rounded-xl border border-border bg-surface p-4 text-xs text-muted">
          {serialized}
        </pre>
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs uppercase text-muted">Template Variable Registry</p>
          <textarea
            className="h-36 w-full rounded border border-border bg-background p-2 text-xs"
            value={registryText}
            onChange={(event) => setRegistryText(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">
            Missing required: {variableOutput.missing.length ? variableOutput.missing.join(", ") : "none"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs uppercase text-muted">Variable Context Preview</p>
          <textarea
            className="h-36 w-full rounded border border-border bg-background p-2 text-xs"
            value={variablesText}
            onChange={(event) => setVariablesText(event.target.value)}
          />
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs uppercase text-muted">Quote Side Panel</p>
          <label className="mb-2 block text-xs text-muted">
            Currency
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={pricing.currency}
              onChange={(event) => setPricing((current) => ({ ...current, currency: event.target.value }))}
            />
          </label>
          <label className="mb-2 block text-xs text-muted">
            Discount %
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
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
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
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
            className="mb-3 w-full rounded border border-border px-2 py-1 text-xs hover:bg-background"
          >
            Add line item
          </button>
          <div className="space-y-2">
            {pricing.items.map((item, index) => (
              <div key={item.id} className="rounded border border-border p-2">
                <input
                  className="mb-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
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
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
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
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
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
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase text-muted">Computed Render Preview</p>
            <select
              className="rounded border border-border bg-background px-2 py-1 text-xs"
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="sender-preview">sender-preview</option>
              <option value="recipient-fill">recipient-fill</option>
              <option value="finalized">finalized</option>
            </select>
          </div>
          <div
            className="prose prose-invert max-h-80 overflow-auto rounded border border-border bg-background p-2 text-xs"
            dangerouslySetInnerHTML={{ __html: computedHtml }}
          />
        </div>
      </aside>
    </section>
  );
}
