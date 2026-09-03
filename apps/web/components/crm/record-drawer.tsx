"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@repo/ui/utils";
import type { CrmActivityRecord } from "@/lib/crm/activity-shared";
import { ActivityPanel, type CrmActivityLinks } from "@/components/crm/activity-panel";
import { CrmFocusHistory } from "@/components/crm/crm-focus-history";
import { CrmNotesEditor } from "@/components/crm/crm-notes-editor";
import { AddressFieldsInput } from "@/components/crm/address-fields-input";
import { CompanySearchInput } from "@/components/crm/company-search-input";
import type { CompanySearchResult } from "@/lib/crm/resolve-company-association";
import {
  emptyAddress,
  formatAddressDisplay,
  type AddressValues,
} from "@/lib/crm/address";
import { isNoteOverLimit, normalizeNoteHtml } from "@/lib/crm/notes-html";
import { normalizeWebsite, websiteHref } from "@/lib/crm/website";

export type DrawerFieldType = "text" | "select" | "company-search" | "address" | "website";

export type DrawerField = {
  id: string;
  icon: DrawerIconId;
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  showLabel?: boolean;
  type?: DrawerFieldType;
  inputType?: "text" | "email" | "tel" | "url";
  options?: Array<{ value: string; label: string }>;
  companyId?: string;
  onCompanySelect?: (company: CompanySearchResult | null) => void;
  address?: AddressValues;
  onAddressChange?: (value: AddressValues) => void;
  onAddressCommit?: (value: AddressValues) => void;
  readOnly?: boolean;
  validate?: (value: string) => string | null;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
};

export type DrawerSection = {
  id: string;
  label: string;
  fields: DrawerField[];
  emptyLabel?: string;
};

export type DrawerHistoryItem = {
  id: string;
  title: string;
  at: string;
  detail?: string;
  kind?: "note" | "created" | "change" | "activity";
  actorName?: string;
};

export type CrmRecordContext = {
  type: "contact" | "lead" | "company";
  id: string;
  links: CrmActivityLinks;
};

type ActivityTab = "activity" | "notes" | "call" | "email" | "files" | "documents";

type CrmRecordDrawerProps = {
  open: boolean;
  variant?: "default" | "person";
  title: string;
  titlePlaceholder: string;
  onTitleChange: (value: string) => void;
  onTitleCommit?: (value: string) => void;
  onClose: () => void;
  sections: DrawerSection[];
  recordKey: string;
  notes: string;
  onNotesSave: (value: string) => void;
  onNotesChange?: (value: string) => void;
  history?: DrawerHistoryItem[];
  crmRecord?: CrmRecordContext;
  error?: string;
  status?: string;
  footerSave?: {
    label?: string;
    onSave: () => void;
    saving?: boolean;
    menuActions?: Array<{
      id: string;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
    }>;
  };
};

export type DrawerIconId =
  | "status"
  | "tag"
  | "value"
  | "source"
  | "person"
  | "company"
  | "mail"
  | "phone"
  | "title"
  | "pin"
  | "web"
  | "industry"
  | "people"
  | "calendar";

function DrawerIcon({ id }: { id: DrawerIconId }) {
  const common = "h-4 w-4 shrink-0 text-muted";
  if (id === "mail") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "phone") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3.5h3.5L12 7.5l-2 1.5a12 12 0 005 5l1.5-2 4 1.5V17a2 2 0 01-2 2C8.5 19 5 12.5 5 5.5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "person") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 19c.8-3 3.2-4.5 7-4.5s6.2 1.5 7 4.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "company") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20V6l8-3 8 3v14H4z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "value") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v8M9.5 10.5c.4-1 1.4-1.5 2.5-1.5s2 .6 2 1.7c0 2.3-4 1.5-4 3.6 0 1.1 1 1.7 2 1.7s2-.5 2.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "web") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 12h16M12 4c2.5 2.8 3.8 5.6 3.8 8S14.5 17.2 12 20C9.5 17.2 8.2 14.4 8.2 12S9.5 6.8 12 4z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "pin") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "tag" || id === "status") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 12V5h7l8 8-7 7-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="8.2" cy="8.2" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (id === "source") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12h11M12 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "people") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 18c.5-2.2 2.4-3.5 5-3.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 18c-.4-1.6-1.8-2.6-3.8-2.6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "calendar") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "title") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="8" width="16" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8V6.5A2.5 2.5 0 0110.5 4h3A2.5 2.5 0 0116 6.5V8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 13h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "industry") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20V9l4-2v13M10 20V5l4-2v17M16 20V11l4-2v11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 7h10v3H7V7zM7 14h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditPencilIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-foreground" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.3 2.3a1.2 1.2 0 011.7 1.7l-7.2 7.2-2.3.6.6-2.3 7.2-7.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FieldEditActions({
  onCancel,
  onSave,
  saveDisabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCancel}
        className="rounded-md border border-border bg-white px-3 py-1 text-[15px] font-medium text-foreground hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSave}
        disabled={saveDisabled}
        className="rounded-md bg-primary px-3 py-1 text-[15px] font-medium text-primary-foreground disabled:opacity-40"
      >
        Save
      </button>
    </div>
  );
}

function fieldDisplayValue(field: DrawerField): string {
  if (field.type === "address") {
    return formatAddressDisplay(field.address);
  }
  if (field.type === "select") {
    if (!field.value) {
      return "";
    }
    return field.options?.find((option) => option.value === field.value)?.label ?? field.value;
  }
  if (field.type === "website") {
    return field.value ? normalizeWebsite(field.value) : "";
  }
  return field.value;
}

function WebsiteLink({ value }: { value: string }) {
  const display = normalizeWebsite(value);
  const href = websiteHref(display);
  if (!display) {
    return null;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {display}
    </a>
  );
}

const FIELD_LABEL_CLASS = "w-[5.25rem] shrink-0 pt-1.5 text-[13px] leading-tight text-foreground";
const FIELD_ICON_CLASS = "flex w-5 shrink-0 justify-center pt-1.5";
const FIELD_ROW_CLASS = "flex items-start gap-1.5 py-0.5";
const FIELD_EDIT_CONTAINER_CLASS = "min-w-0 flex-1 rounded-none bg-slate-50 p-1.5";
const FIELD_TEXT_CLASS = "text-[15px]";

function FieldRowLabel({ field }: { field: DrawerField }) {
  if (field.showLabel === false) {
    return <span className="sr-only">{field.label}</span>;
  }
  return <span className={FIELD_LABEL_CLASS}>{field.label}</span>;
}

function FieldRowIcon({ field }: { field: DrawerField }) {
  return (
    <span className={FIELD_ICON_CLASS} aria-hidden>
      <DrawerIcon id={field.icon} />
    </span>
  );
}

function FieldRow({ field }: { field: DrawerField }) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(field.value);
  const [draftAddress, setDraftAddress] = useState<AddressValues>(field.address ?? emptyAddress());
  const [attemptedSave, setAttemptedSave] = useState(false);
  const initialValueRef = useRef(field.value);
  const initialAddressRef = useRef<AddressValues>(field.address ?? emptyAddress());
  const initialCompanyRef = useRef<CompanySearchResult | null>(null);
  const isCompanySearch = field.type === "company-search";
  const isAddress = field.type === "address";
  const isWebsite = field.type === "website";

  useEffect(() => {
    if (!editing) {
      setDraftValue(field.value);
      setDraftAddress(field.address ?? emptyAddress());
    }
  }, [field.address, field.value, editing]);

  function updateDraftValue(next: string) {
    setDraftValue(next);
    field.onChange(next);
    if (isCompanySearch && field.companyId) {
      const linkedName = initialCompanyRef.current?.name ?? field.value;
      if (next.trim().toLowerCase() !== linkedName.trim().toLowerCase()) {
        field.onCompanySelect?.(null);
      }
    }
  }

  function selectCompany(company: CompanySearchResult) {
    setDraftValue(company.name);
    field.onChange(company.name);
    field.onCompanySelect?.(company);
  }

  function updateDraftAddress(next: AddressValues) {
    setDraftAddress(next);
    field.onAddressChange?.(next);
  }

  const error =
    editing && attemptedSave
      ? isAddress
        ? null
        : (field.validate?.(isWebsite ? normalizeWebsite(draftValue) : draftValue) ?? null)
      : null;
  const showError = Boolean(error);
  const inputClass = cn(
    "h-8 w-full rounded-none border bg-white px-2 outline-none focus:ring-2",
    FIELD_TEXT_CLASS,
    showError
      ? "border-red-400 ring-red-200 focus:ring-red-200"
      : "border-border ring-primary/15 focus:ring-primary/15",
  );
  const displayValue = fieldDisplayValue(field);
  const canEdit = !field.readOnly;

  function startEditing() {
    if (!canEdit) {
      return;
    }
    initialValueRef.current = field.value;
    initialAddressRef.current = field.address ?? emptyAddress();
    initialCompanyRef.current =
      field.companyId && field.value
        ? { id: field.companyId, name: field.value }
        : null;
    setDraftValue(field.value);
    setDraftAddress(field.address ?? emptyAddress());
    setAttemptedSave(false);
    setEditing(true);
  }

  function cancelEditing() {
    field.onChange(initialValueRef.current);
    field.onAddressChange?.(initialAddressRef.current);
    field.onCompanySelect?.(initialCompanyRef.current);
    setDraftValue(initialValueRef.current);
    setDraftAddress(initialAddressRef.current);
    setAttemptedSave(false);
    setEditing(false);
  }

  function saveEditing() {
    setAttemptedSave(true);
    if (isAddress) {
      field.onAddressChange?.(draftAddress);
      field.onAddressCommit?.(draftAddress);
      setAttemptedSave(false);
      setEditing(false);
      return;
    }
    const nextValue = isWebsite ? normalizeWebsite(draftValue) : draftValue;
    const nextError = field.validate?.(nextValue) ?? null;
    if (nextError) {
      return;
    }
    setDraftValue(nextValue);
    field.onChange(nextValue);
    field.onCommit?.(nextValue);
    setAttemptedSave(false);
    setEditing(false);
  }

  const errorMessage = showError ? (
    <p className="pt-1 text-xs text-red-600" role="alert">
      {error}
    </p>
  ) : null;

  if (editing) {
    return (
      <div className={FIELD_ROW_CLASS}>
        <FieldRowIcon field={field} />
        <div className={FIELD_EDIT_CONTAINER_CLASS}>
          <span className="sr-only">{field.label}</span>
          {field.type === "select" ? (
            <select
              className={cn(inputClass, "cursor-pointer", !draftValue && "text-muted")}
              value={draftValue}
              aria-label={field.label}
              aria-invalid={showError}
              onChange={(event) => updateDraftValue(event.target.value)}
            >
              <option value="">{field.placeholder}</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.type === "company-search" ? (
            <CompanySearchInput
              value={draftValue}
              placeholder={field.placeholder}
              className={inputClass}
              onValueChange={updateDraftValue}
              onCompanySelect={selectCompany}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveEditing();
                }
                if (event.key === "Escape") {
                  cancelEditing();
                }
              }}
            />
          ) : field.type === "address" ? (
            <AddressFieldsInput value={draftAddress} onChange={updateDraftAddress} />
          ) : (
            <input
              autoFocus
              type="text"
              autoComplete={
                field.inputType === "email"
                  ? "email"
                  : field.inputType === "tel"
                    ? "tel"
                    : isWebsite
                      ? "url"
                      : "off"
              }
              inputMode={
                field.inputType === "email" ? "email" : field.inputType === "tel" ? "tel" : undefined
              }
              className={inputClass}
              value={draftValue}
              placeholder={field.placeholder}
              aria-invalid={showError}
              aria-label={field.label}
              onChange={(event) => updateDraftValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveEditing();
                }
                if (event.key === "Escape") {
                  cancelEditing();
                }
              }}
            />
          )}
          <FieldEditActions onCancel={cancelEditing} onSave={saveEditing} />
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={FIELD_ROW_CLASS}>
      <FieldRowIcon field={field} />
      <FieldRowLabel field={field} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "group flex min-h-8 items-center justify-between rounded-md px-1.5 py-1",
            canEdit && "cursor-pointer hover:bg-slate-100",
          )}
          onClick={canEdit ? startEditing : undefined}
          onKeyDown={
            canEdit
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    startEditing();
                  }
                }
              : undefined
          }
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
        >
          <span
            className={cn(
              "min-w-0",
              isAddress ? "whitespace-pre-wrap" : "truncate",
              FIELD_TEXT_CLASS,
              displayValue ? "text-foreground" : "text-muted",
            )}
          >
            {isWebsite && field.value ? (
              <WebsiteLink value={field.value} />
            ) : (
              displayValue || field.placeholder
            )}
            {field.hint && field.value ? <span className="ml-1 text-muted">({field.hint})</span> : null}
          </span>
          {canEdit ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                startEditing();
              }}
              className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              aria-label={`Edit ${field.label}`}
            >
              <EditPencilIcon />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-3 py-2 text-sm",
        active ? "border-primary font-medium text-foreground" : "border-transparent text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const DRAWER_SLIDE_MS = 200;

function CloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onMouseDown={(event) => {
        // Prevent a focused title field from stealing the click on blur/re-render.
        event.preventDefault();
        onClick();
      }}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-foreground",
        className,
      )}
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function initialsFromTitle(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "P").toUpperCase();
}

function CollapsibleSection({
  label,
  children,
  empty,
}: {
  label: string;
  children: ReactNode;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-2 border-b border-border pb-2 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-1.5 text-left"
      >
        <h3 className="text-[14px] font-semibold text-foreground">{label}</h3>
        <span className={cn("text-muted transition-transform", open ? "rotate-180" : "")}>▾</span>
      </button>
      {open ? children : null}
      {open && empty ? <p className="pb-2 text-sm text-muted">Nothing here yet.</p> : null}
    </section>
  );
}

export function CrmRecordDrawer({
  open,
  variant = "default",
  title,
  titlePlaceholder,
  onTitleChange,
  onTitleCommit,
  onClose,
  recordKey,
  sections,
  notes,
  onNotesSave,
  onNotesChange,
  history,
  crmRecord,
  error,
  status,
  footerSave,
}: CrmRecordDrawerProps) {
  const titleId = useId();
  const [tab, setTab] = useState<ActivityTab>("notes");
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNotes, setDraftNotes] = useState(notes);
  const savedNotesRef = useRef(notes);
  const titleDirtyRef = useRef(false);
  const [footerMenuOpen, setFooterMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [timelineHistory, setTimelineHistory] = useState<DrawerHistoryItem[]>([]);
  const [openActivities, setOpenActivities] = useState<CrmActivityRecord[]>([]);
  const [notesEditorKey, setNotesEditorKey] = useState(0);
  const [editingActivity, setEditingActivity] = useState<CrmActivityRecord | null>(null);

  const loadCrmData = useCallback(async () => {
    if (!crmRecord?.id) {
      setTimelineHistory([]);
      setOpenActivities([]);
      return;
    }
    const timelineParams = new URLSearchParams();
    const activityParams = new URLSearchParams();
    if (crmRecord.type === "contact") {
      timelineParams.set("contactId", crmRecord.id);
      activityParams.set("contactId", crmRecord.id);
    } else if (crmRecord.type === "lead") {
      timelineParams.set("leadId", crmRecord.id);
      activityParams.set("leadId", crmRecord.id);
    } else {
      timelineParams.set("companyId", crmRecord.id);
      activityParams.set("companyId", crmRecord.id);
    }
    const [timelineRes, activitiesRes] = await Promise.all([
      fetch(`/api/crm/timeline?${timelineParams.toString()}`),
      fetch(`/api/crm/activities?${activityParams.toString()}`),
    ]);
    if (timelineRes.ok) {
      const payload = (await timelineRes.json()) as { history?: DrawerHistoryItem[] };
      setTimelineHistory(payload.history ?? []);
    }
    if (activitiesRes.ok) {
      const payload = (await activitiesRes.json()) as { activities?: CrmActivityRecord[] };
      setOpenActivities((payload.activities ?? []).filter((activity) => !activity.completed_at));
    }
  }, [crmRecord]);

  useEffect(() => {
    if (open) {
      void loadCrmData();
    }
  }, [open, loadCrmData, recordKey]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      let inner = 0;
      const frame = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(inner);
      };
    }
    setEntered(false);
    const timeout = window.setTimeout(() => setVisible(false), DRAWER_SLIDE_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    savedNotesRef.current = notes;
    setDraftNotes(notes);
    setTab("notes");
    setDraftTitle(title);
    setEditingTitle(!title);
    titleDirtyRef.current = false;
    setFooterMenuOpen(false);
    setEditingActivity(null);
    // Reset editor chrome when switching records, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordKey/open are the record identity
  }, [recordKey, open]);

  useEffect(() => {
    if (!editingTitle || !titleDirtyRef.current) {
      setDraftTitle(title);
    }
  }, [title, editingTitle]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !visible) {
    return null;
  }

  const notesChanged =
    normalizeNoteHtml(draftNotes) !== normalizeNoteHtml(savedNotesRef.current);
  const isPerson = variant === "person";
  const activeHistory = crmRecord?.id ? timelineHistory : (history ?? []);
  const tabs: Array<{ id: ActivityTab; label: string }> = isPerson
    ? [
        { id: "activity", label: "Activity" },
        { id: "notes", label: "Notes" },
        { id: "call", label: "Call" },
        { id: "email", label: "Email" },
        { id: "files", label: "Files" },
        { id: "documents", label: "Documents" },
      ]
    : [
        { id: "notes", label: "Notes" },
        { id: "activity", label: "Activity" },
        { id: "email", label: "Email" },
        { id: "files", label: "Files" },
      ];

  return createPortal(
    <div className="app-theme fixed inset-x-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] justify-end">
      <button
        type="button"
        aria-label="Close record"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-slate-900/15 transition-opacity duration-200 ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-full w-full max-w-[88rem] bg-surface shadow-[-12px_0_32px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out",
          entered ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex w-[21rem] shrink-0 flex-col border-r border-border">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
            {isPerson ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground">
                {initialsFromTitle(title || titlePlaceholder)}
              </span>
            ) : null}
            {editingTitle ? (
              <div className="min-w-0 flex-1 rounded-none bg-slate-50 p-2">
                <input
                  id={titleId}
                  autoFocus
                  className="h-9 w-full rounded-none border border-border bg-white px-2 text-[19px] font-semibold outline-none ring-primary/15 focus:ring-2"
                  value={draftTitle}
                  placeholder={titlePlaceholder}
                  onChange={(event) => {
                    const next = event.target.value;
                    titleDirtyRef.current = true;
                    setDraftTitle(next);
                    onTitleChange(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onTitleCommit?.(draftTitle);
                      titleDirtyRef.current = false;
                      setEditingTitle(false);
                    }
                    if (event.key === "Escape") {
                      titleDirtyRef.current = false;
                      setDraftTitle(title);
                      onTitleChange(title);
                      setEditingTitle(false);
                    }
                  }}
                />
                <FieldEditActions
                  onCancel={() => {
                    titleDirtyRef.current = false;
                    setDraftTitle(title);
                    onTitleChange(title);
                    setEditingTitle(false);
                  }}
                  onSave={() => {
                    onTitleCommit?.(draftTitle);
                    titleDirtyRef.current = false;
                    setEditingTitle(false);
                  }}
                />
              </div>
            ) : (
              <div
                className="group min-w-0 flex-1 cursor-pointer rounded-md px-2 py-1 hover:bg-slate-100"
                onClick={() => setEditingTitle(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setEditingTitle(true);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    id={titleId}
                    className={cn("truncate text-[19px] font-semibold", title ? "text-foreground" : "text-muted")}
                  >
                    {title || titlePlaceholder}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingTitle(true);
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    aria-label="Edit title"
                  >
                    <EditPencilIcon />
                  </button>
                </div>
              </div>
            )}
            <CloseButton onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2">
            {sections.map((section) => {
              const body = (
                <div>
                  {section.fields.map((field) => (
                    <FieldRow key={field.id} field={field} />
                  ))}
                </div>
              );
              if (isPerson) {
                return (
                  <CollapsibleSection
                    key={section.id}
                    label={section.label}
                    empty={section.fields.length === 0}
                  >
                    {section.fields.length > 0 ? body : null}
                  </CollapsibleSection>
                );
              }
              return (
                <section key={section.id} className="mb-5">
                  <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
                    {section.label}
                  </h3>
                  {body}
                </section>
              );
            })}
          </div>
          {footerSave ? (
            <div className="relative shrink-0 border-t border-border px-3.5 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={footerSave.saving}
                  onClick={footerSave.onSave}
                  className="min-w-0 flex-1 rounded-md bg-primary px-3 py-2 text-[15px] font-medium text-primary-foreground disabled:opacity-60"
                >
                  {footerSave.label ?? "Save"}
                </button>
                {footerSave.menuActions && footerSave.menuActions.length > 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="More actions"
                      disabled={footerSave.saving}
                      onClick={() => setFooterMenuOpen((value) => !value)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-foreground hover:bg-slate-50 disabled:opacity-60"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </button>
                    {footerMenuOpen ? (
                      <div className="absolute bottom-full right-0 z-20 mb-1 min-w-[11rem] rounded-md border border-border bg-white py-1 shadow-lg">
                        {footerSave.menuActions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            disabled={action.disabled || footerSave.saving}
                            onClick={() => {
                              setFooterMenuOpen(false);
                              action.onSelect();
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-slate-50 disabled:opacity-50"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-3">
            <div className="flex min-w-0 overflow-x-auto">
              {tabs.map((item) => (
                <TabButton
                  key={item.id}
                  active={tab === item.id}
                  onClick={() => {
                    if (item.id !== "activity") {
                      setEditingActivity(null);
                    }
                    setTab(item.id);
                  }}
                >
                  {item.label}
                </TabButton>
              ))}
            </div>
            <div className="flex items-center gap-2 py-2 pr-1">
              <CloseButton onClick={onClose} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            {status ? <p className="mb-3 text-sm text-emerald-700">{status}</p> : null}

            {tab === "notes" ? (
              <CrmNotesEditor
                contentKey={`${recordKey}-${notesEditorKey}`}
                value={draftNotes}
                onChange={(html) => {
                  setDraftNotes(html);
                  onNotesChange?.(html);
                }}
                onReady={(html) => {
                  savedNotesRef.current = html;
                  setDraftNotes(html);
                }}
                showActions
                dirty={notesChanged}
                onCancel={() => {
                  setDraftNotes(savedNotesRef.current);
                  onNotesChange?.(savedNotesRef.current);
                  setNotesEditorKey((key) => key + 1);
                }}
                onSave={() => {
                  const next = normalizeNoteHtml(draftNotes);
                  if (isNoteOverLimit(next)) {
                    return;
                  }
                  savedNotesRef.current = next;
                  setDraftNotes(next);
                  onNotesSave(next);
                }}
                placeholder="Write a note…"
              />
            ) : null}

            {tab === "activity" ? (
              <ActivityPanel
                key={editingActivity?.id ?? "new-activity"}
                links={crmRecord?.links ?? {}}
                recordSaved={Boolean(crmRecord?.id)}
                editingActivity={editingActivity}
                onCancelEdit={() => setEditingActivity(null)}
                onSaved={(result) => {
                  void loadCrmData();
                  setEditingActivity(null);
                  if (result.mode === "create") {
                    onClose();
                  } else {
                    setTab("notes");
                  }
                }}
              />
            ) : null}
            {tab === "call" ? (
              <p className="py-8 text-center text-sm text-muted">No calls yet.</p>
            ) : null}
            {tab === "email" ? (
              <p className="py-8 text-center text-sm text-muted">No email yet.</p>
            ) : null}
            {tab === "files" ? (
              <p className="py-8 text-center text-sm text-muted">No files yet.</p>
            ) : null}
            {tab === "documents" ? (
              <p className="py-8 text-center text-sm text-muted">No documents yet.</p>
            ) : null}

            <CrmFocusHistory
              links={crmRecord?.links ?? {}}
              activities={openActivities}
              history={activeHistory}
              onActivityChanged={() => {
                void loadCrmData();
              }}
              onEditActivity={(activity) => {
                setEditingActivity(activity);
                setTab("activity");
              }}
            />
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
