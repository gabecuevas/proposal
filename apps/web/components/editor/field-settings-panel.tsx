"use client";

import { FIELD_OPTIONS_MENU_WIDTH } from "@/lib/editor/place-field-menu";
import type { SignerFieldAttrs, SignerFieldValidation } from "@/lib/editor/signer-field-attrs";
import { SIGNER_FIELD_VALIDATIONS, SINGLE_LINE_FIELD_H_PCT } from "@/lib/editor/signer-field-attrs";
import type { SignerRecipientOption } from "./signer-field-context";

type Props = {
  attrs: SignerFieldAttrs;
  recipients: SignerRecipientOption[];
  onChange: (partial: Record<string, unknown>) => void;
  onCopy: () => void;
  onCut: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  maxHeight?: number;
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-8 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-slate-300"
        }`}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left]"
          style={{ left: checked ? 14 : 2 }}
        />
      </button>
    </label>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const sectionLabel = "text-[11px] font-semibold uppercase tracking-wide text-muted";
const fieldInput =
  "mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-primary/40";

export function FieldSettingsPanel({
  attrs,
  recipients,
  onChange,
  onCopy,
  onCut,
  onDuplicate,
  onDelete,
  maxHeight,
}: Props) {
  const assigned = recipients.find((recipient) => recipient.id === attrs.recipientId);
  const isText = attrs.type === "text";

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface text-[13px] text-foreground shadow-xl"
      style={{ width: FIELD_OPTIONS_MENU_WIDTH, ...(maxHeight ? { maxHeight } : {}) }}
    >
      <div className="shrink-0 px-3 pt-2.5">
        <p className={sectionLabel}>Assign to</p>
        <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
          <button
            type="button"
            onClick={() => onChange({ recipientId: "" })}
            className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left ${
              !attrs.recipientId ? "border-primary/40 bg-primary/[0.06]" : "border-border hover:bg-slate-50"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] text-muted">
              —
            </span>
            <span className="truncate text-[13px] font-medium">Unassigned</span>
          </button>
          {recipients.map((recipient) => {
            const selected = recipient.id === attrs.recipientId;
            return (
              <button
                key={recipient.id}
                type="button"
                onClick={() => onChange({ recipientId: recipient.id })}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left ${
                  selected ? "border-primary/40 bg-primary/[0.06]" : "border-border hover:bg-slate-50"
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials(recipient.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{recipient.name}</span>
                    <span className="text-[11px] text-primary">
                      {recipient.role === "sender" ? "Sender" : "Signer"}
                    </span>
                  </span>
                  {recipient.email ? (
                    <span className="block truncate text-[11px] leading-snug text-muted">{recipient.email}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        {!assigned && recipients.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-muted">Add a recipient to assign this field.</p>
        ) : null}
      </div>

      <div className="mx-3 mt-2 shrink-0 border-t border-border pt-2">
        <Toggle label="Required field" checked={attrs.required} onChange={(required) => onChange({ required })} />
        {isText ? (
          <>
            <Toggle
              label="Multiline text"
              checked={attrs.multiline}
              onChange={(multiline) => onChange({ multiline, hPct: multiline ? Math.max(attrs.hPct, 0.09) : SINGLE_LINE_FIELD_H_PCT })}
            />
            <Toggle label="Mask field value" checked={attrs.maskValue} onChange={(maskValue) => onChange({ maskValue })} />
          </>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2.5">
        {isText || attrs.type === "date" ? (
          <label className="mt-1.5 block border-t border-border pt-2">
            <span className={sectionLabel}>Validation</span>
            <select
              className={fieldInput}
              value={attrs.validation}
              onChange={(event) => onChange({ validation: event.target.value as SignerFieldValidation })}
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

        <label className="mt-2 block border-t border-border pt-2">
          <span className={sectionLabel}>Placeholder</span>
          <input
            className={fieldInput}
            value={attrs.placeholder}
            onChange={(event) => onChange({ placeholder: event.target.value })}
          />
        </label>

        <label className="mt-2 block border-t border-border pt-2">
          <span className={sectionLabel}>Field ID</span>
          <input
            className={`${fieldInput} font-mono text-[12px]`}
            value={attrs.fieldId}
            onChange={(event) => onChange({ fieldId: event.target.value })}
          />
        </label>

        <label className="mt-2 block border-t border-border pt-2">
          <span className={sectionLabel}>Merge field</span>
          <input
            className={fieldInput}
            value={attrs.mergeField}
            placeholder="Enter name of merge field"
            onChange={(event) => onChange({ mergeField: event.target.value })}
          />
          <span className="mt-1 block text-[11px] leading-snug text-muted">
            Map a CRM variable or API field so customer data can fill this later.
          </span>
        </label>

        {attrs.type === "dropdown" ? (
          <label className="mt-2 block border-t border-border pt-2">
            <span className={sectionLabel}>Options</span>
            <textarea
              className={`${fieldInput} h-16 font-mono text-[10px]`}
              value={attrs.dropdownOptions}
              onChange={(event) => onChange({ dropdownOptions: event.target.value })}
            />
          </label>
        ) : null}

        <div className="mt-2 border-t border-border py-1">
          <Action label="Copy" shortcut="⌘C" onClick={onCopy} />
          <Action label="Cut" shortcut="⌘X" onClick={onCut} />
          <Action label="Duplicate" onClick={onDuplicate} />
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Action({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-slate-50"
    >
      <span>{label}</span>
      {shortcut ? <span className="text-[11px] text-muted">{shortcut}</span> : null}
    </button>
  );
}
