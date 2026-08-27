"use client";

import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import { parseSignerFieldAttrs, SIGNER_FIELD_VALIDATIONS, SINGLE_LINE_FIELD_H_PCT, type SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { useSignerRecipients } from "./signer-field-context";

type Props = {
  editor: Editor | null;
  hideEmpty?: boolean;
};

const fieldTypes: SignerFieldEditorType[] = [
  "signature",
  "initial",
  "date",
  "text",
  "checkbox",
  "dropdown",
];

export function SignerFieldPropertiesPanel({ editor, hideEmpty }: Props) {
  const recipients = useSignerRecipients();
  const [fieldPos, setFieldPos] = useState<number | null>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const sync = () => {
      const { selection } = editor.state;
      if (selection instanceof NodeSelection && selection.node.type.name === "signerField") {
        setFieldPos(selection.from);
        return;
      }
      setFieldPos(null);
    };
    editor.on("selectionUpdate", sync);
    sync();
    return () => {
      editor.off("selectionUpdate", sync);
    };
  }, [editor]);

  if (!editor || fieldPos === null) {
    if (hideEmpty) {
      return null;
    }
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Field properties</p>
        <p className="mt-2 text-xs text-muted">Select a field on the canvas to edit its properties.</p>
      </div>
    );
  }

  const node = editor.state.doc.nodeAt(fieldPos);
  if (!node || node.type.name !== "signerField") {
    return null;
  }

  const attrs = parseSignerFieldAttrs(node.attrs as Record<string, unknown>, 0);

  function update(partial: Record<string, unknown>) {
    if (!editor || fieldPos === null) {
      return;
    }
    const pos = fieldPos;
    editor.chain().focus().setNodeSelection(pos).updateAttributes("signerField", partial).run();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Field properties</p>
      <div className="mt-3 space-y-2 text-xs">
        <label className="block text-muted">
          Assigned role
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={attrs.recipientId}
            onChange={(event) => update({ recipientId: event.target.value })}
          >
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-muted">
          Field type
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs capitalize"
            value={attrs.type}
            onChange={(event) => update({ type: event.target.value as SignerFieldEditorType })}
          >
            {fieldTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={attrs.required}
            onChange={(event) => update({ required: event.target.checked })}
          />
          Required
        </label>
        {attrs.type === "text" ? (
          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={attrs.multiline}
              onChange={(event) => update({ multiline: event.target.checked, hPct: event.target.checked ? Math.max(attrs.hPct, 0.09) : SINGLE_LINE_FIELD_H_PCT })}
            />
            Multiline
          </label>
        ) : null}
        {attrs.type === "text" || attrs.type === "date" ? (
          <label className="block text-muted">
            Validation
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={attrs.validation}
              onChange={(event) => update({ validation: event.target.value })}
            >
              {SIGNER_FIELD_VALIDATIONS.filter((item) => attrs.type !== "date" || item.id === "none" || item.id === "date").map(
                (item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
        <label className="block text-muted">
          Label
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={attrs.label}
            onChange={(event) => update({ label: event.target.value })}
          />
        </label>
        <label className="block text-muted">
          Placeholder
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={attrs.placeholder}
            onChange={(event) => update({ placeholder: event.target.value })}
          />
        </label>
        <label className="block text-muted">
          Field ID
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
            value={attrs.fieldId}
            onChange={(event) => update({ fieldId: event.target.value })}
          />
        </label>
        <label className="block text-muted">
          Merge field
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={attrs.mergeField}
            placeholder="Enter name of merge field"
            onChange={(event) => update({ mergeField: event.target.value })}
          />
        </label>
        <label className="block text-muted">
          Default value
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={attrs.defaultValue}
            onChange={(event) => update({ defaultValue: event.target.value })}
          />
        </label>
        {attrs.type === "dropdown" ? (
          <label className="block text-muted">
            Dropdown options (JSON array)
            <textarea
              className="mt-1 h-20 w-full rounded border border-border bg-background p-2 font-mono text-[11px]"
              value={attrs.dropdownOptions}
              onChange={(event) => update({ dropdownOptions: event.target.value })}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
