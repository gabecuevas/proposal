"use client";

import { useState, type ReactNode } from "react";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { SignerFieldPropertiesPanel } from "@/components/editor/signer-field-properties";
import type { Editor } from "@tiptap/core";
import { COLLAPSED_FIELD_COUNT, FIELD_DRAG_MIME, fieldTypes } from "./field-types";
import {
  IconBraces,
  IconChevron,
  IconDragHandle,
  IconPeople,
  IconTable,
} from "./creator-icons";

type Recipient = { id: string; name: string; email?: string };

type Props = {
  editor: Editor | null;
  recipients: Recipient[];
  selectedRecipientId: string;
  onSelectRecipient: (id: string) => void;
  onInsertField: (type: SignerFieldEditorType) => void;
  missingVariableCount: number;
  unassignedRoleCount: number;
  onManageRecipients?: () => void;
  onManageVariables?: () => void;
  onReviewData?: () => void;
};

export function CreatorFieldsSidebar({
  editor,
  recipients,
  selectedRecipientId,
  onSelectRecipient,
  onInsertField,
  missingVariableCount,
  unassignedRoleCount,
  onManageRecipients,
  onManageVariables,
  onReviewData,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const selected = recipients.find((r) => r.id === selectedRecipientId) ?? recipients[0];
  const visible = expanded ? fieldTypes : fieldTypes.slice(0, COLLAPSED_FIELD_COUNT);

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Add fillable fields</h2>
      </div>

      <div className="border-b border-border px-3 py-3">
        <label className="block">
          <span className="sr-only">Assigned role</span>
          <div className="relative">
            <select
              className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-3 pr-8 text-sm outline-none ring-primary/15 focus:ring-2"
              value={selectedRecipientId}
              onChange={(event) => onSelectRecipient(event.target.value)}
            >
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.name}
                </option>
              ))}
            </select>
            <IconChevron className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </label>
        {selected ? (
          <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">Signer</p>
            {selected.email ? (
              <p className="mt-0.5 truncate text-xs text-muted">{selected.email}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 px-3 py-3">
        {visible.map((field) => {
          const enabled = field.editorType !== null;
          return (
            <button
              key={field.id}
              type="button"
              disabled={!enabled}
              draggable={enabled}
              onClick={() => {
                if (field.editorType) {
                  onInsertField(field.editorType);
                }
              }}
              onDragStart={(event) => {
                if (!field.editorType) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData(FIELD_DRAG_MIME, field.editorType);
                event.dataTransfer.effectAllowed = "copy";
              }}
              title={enabled ? `Add ${field.label}` : `${field.label} is coming soon`}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                enabled
                  ? "cursor-grab border-transparent bg-primary/[0.08] text-foreground hover:bg-primary/[0.14] active:cursor-grabbing"
                  : "cursor-not-allowed border-transparent bg-slate-50 text-muted"
              }`}
            >
              <field.Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 font-medium">{field.label}</span>
              <IconDragHandle className="h-3.5 w-3.5 shrink-0 text-muted" />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-1 text-center text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>

      <div className="mt-auto border-t border-border px-3 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          More actions
        </p>
        <ActionRow
          icon={<IconPeople />}
          label="Manage recipients"
          badge={unassignedRoleCount}
          badgeLabel="Assign roles"
          onClick={onManageRecipients}
        />
        <ActionRow
          icon={<IconBraces />}
          label="Manage variables"
          badge={missingVariableCount}
          badgeLabel="Fill variables"
          onClick={onManageVariables}
        />
        <ActionRow icon={<IconTable />} label="Review data" onClick={onReviewData} />
      </div>

      <div className="border-t border-border px-3 py-3">
        <SignerFieldPropertiesPanel editor={editor} hideEmpty />
      </div>
    </aside>
  );
}

function ActionRow({
  icon,
  label,
  badge,
  badgeLabel,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  badge?: number;
  badgeLabel?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm text-foreground hover:bg-slate-50"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && badge > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          {badgeLabel ? <span className="text-xs text-muted">{badgeLabel}</span> : null}
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        </span>
      ) : null}
    </button>
  );
}
