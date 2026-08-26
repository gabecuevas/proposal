"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { SignerFieldPropertiesPanel } from "@/components/editor/signer-field-properties";
import type { Editor } from "@tiptap/core";
import { FIELD_DRAG_MIME, fieldTypes } from "./field-types";
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

const STORAGE_KEY = "doxysign-fields-panel-open";

function readOpen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

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
  const [open, setOpen] = useState(false);
  const selected = recipients.find((r) => r.id === selectedRecipientId) ?? recipients[0];

  useEffect(() => {
    setOpen(readOpen());
  }, []);

  const toggle = useCallback(() => {
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  if (!open) {
    return (
      <aside className="flex h-full w-12 shrink-0 flex-col items-center overflow-y-auto border-l border-border bg-surface py-2">
        <button
          type="button"
          onClick={toggle}
          className="mb-2 flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-foreground"
          aria-label="Show fillable fields"
          title="Show fillable fields"
        >
          «
        </button>
        <div className="flex flex-col items-center gap-1">
          {fieldTypes.map((field) => (
            <FieldIconButton
              key={field.id}
              field={field}
              onInsertField={onInsertField}
            />
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1 border-t border-border pt-2">
          <IconAction
            label="Manage recipients"
            badge={unassignedRoleCount}
            onClick={onManageRecipients}
          >
            <IconPeople className="h-4 w-4" />
          </IconAction>
          <IconAction label="Manage variables" badge={missingVariableCount} onClick={onManageVariables}>
            <IconBraces className="h-4 w-4" />
          </IconAction>
          <IconAction label="Review data" onClick={onReviewData}>
            <IconTable className="h-4 w-4" />
          </IconAction>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[300px] max-w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Add fillable fields</h2>
        <button
          type="button"
          onClick={toggle}
          className="mt-0.5 flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-foreground"
          aria-label="Hide fillable fields"
          title="Hide fillable fields"
        >
          »
        </button>
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
        {fieldTypes.map((field) => (
          <FieldRow key={field.id} field={field} onInsertField={onInsertField} />
        ))}
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

function FieldRow({
  field,
  onInsertField,
}: {
  field: (typeof fieldTypes)[number];
  onInsertField: (type: SignerFieldEditorType) => void;
}) {
  const enabled = field.editorType !== null;
  return (
    <button
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
}

function FieldIconButton({
  field,
  onInsertField,
}: {
  field: (typeof fieldTypes)[number];
  onInsertField: (type: SignerFieldEditorType) => void;
}) {
  const enabled = field.editorType !== null;
  return (
    <button
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
      aria-label={enabled ? `Add ${field.label}` : `${field.label} is coming soon`}
      title={enabled ? field.label : `${field.label} is coming soon`}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${
        enabled
          ? "text-primary hover:bg-primary/[0.12]"
          : "cursor-not-allowed text-muted/50"
      }`}
    >
      <field.Icon className="h-4 w-4" />
    </button>
  );
}

function IconAction({
  children,
  label,
  badge,
  onClick,
}: {
  children: ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-foreground"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
      ) : null}
    </button>
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
