"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  firstContactDetailsError,
  validateEmail,
  validatePersonName,
  validatePhone,
  validateTitle,
} from "@/lib/crm/contact-field-validation";

import {
  phoneTypeLabel,
  phonesForEditor,
  type PhoneEntry,
} from "@/lib/crm/phones";

export type CompanyPerson = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  phones?: PhoneEntry[];
  title: string | null;
};

export type PersonDraft = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
};

const emptyDraft = (): PersonDraft => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  title: "",
});

function draftFromPerson(person: CompanyPerson): PersonDraft {
  return {
    first_name: person.first_name,
    last_name: person.last_name,
    email: person.email,
    phone: person.phone ?? "",
    title: person.title ?? "",
  };
}

type CompanyPeopleSectionProps = {
  people: CompanyPerson[];
  primaryContactId: string | null;
  disabled?: boolean;
  disabledReason?: string;
  onSetPrimary: (contactId: string) => void;
  /** Returns null on success, or an error message to show under the form. */
  onAddPerson: (draft: PersonDraft) => Promise<string | null>;
  onUpdatePerson: (contactId: string, draft: PersonDraft) => Promise<string | null>;
  onDeletePerson: (contactId: string) => Promise<string | null>;
};

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 shrink-0 text-muted", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 19c.8-3 3.2-4.5 7-4.5s6.2 1.5 7 4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h3.5L12 7.5l-2 1.5a12 12 0 005 5l1.5-2 4 1.5V17a2 2 0 01-2 2C8.5 19 5 12.5 5 5.5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TitleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M8 7v10M16 7v10M10 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditPencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonFormFields({
  draft,
  setDraft,
  setError,
}: {
  draft: PersonDraft;
  setDraft: (updater: (current: PersonDraft) => PersonDraft) => void;
  setError: (value: string) => void;
}) {
  return (
    <>
      <label className="block text-xs text-muted">
        First name
        <input
          value={draft.first_name}
          onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))}
          onBlur={() => {
            const message = validatePersonName(draft.first_name, "First name");
            if (message) setError(message);
          }}
          className="mt-1 h-9 w-full rounded-md border border-border px-2.5 text-sm text-foreground"
          placeholder="First name"
        />
      </label>
      <label className="block text-xs text-muted">
        Last name
        <input
          value={draft.last_name}
          onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))}
          onBlur={() => {
            const message = validatePersonName(draft.last_name, "Last name");
            if (message) setError(message);
          }}
          className="mt-1 h-9 w-full rounded-md border border-border px-2.5 text-sm text-foreground"
          placeholder="Last name"
        />
      </label>
      <label className="block text-xs text-muted">
        Email
        <input
          type="email"
          value={draft.email}
          onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
          onBlur={() => {
            const message = validateEmail(draft.email);
            if (message) setError(message);
          }}
          className="mt-1 h-9 w-full rounded-md border border-border px-2.5 text-sm text-foreground"
          placeholder="Add email"
        />
      </label>
      <label className="block text-xs text-muted">
        Phone
        <input
          type="tel"
          value={draft.phone}
          onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
          onBlur={() => {
            const message = validatePhone(draft.phone);
            if (message) setError(message);
          }}
          className="mt-1 h-9 w-full rounded-md border border-border px-2.5 text-sm text-foreground"
          placeholder="Add phone"
        />
      </label>
      <label className="block text-xs text-muted">
        Title
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          onBlur={() => {
            const message = validateTitle(draft.title);
            if (message) setError(message);
          }}
          className="mt-1 h-9 w-full rounded-md border border-border px-2.5 text-sm text-foreground"
          placeholder="Title"
        />
      </label>
    </>
  );
}

export function CompanyPeopleSection({
  people,
  primaryContactId,
  disabled,
  disabledReason,
  onSetPrimary,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: CompanyPeopleSectionProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpenId) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpenId]);

  const resolvedPrimaryId =
    primaryContactId && people.some((person) => person.id === primaryContactId)
      ? primaryContactId
      : people[0]?.id ?? null;

  async function handleCreate() {
    const message = firstContactDetailsError({
      first_name: draft.first_name,
      last_name: draft.last_name,
      email: draft.email,
      phone: draft.phone,
      title: draft.title,
    });
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError("");
    const messageFromSave = await onAddPerson(draft);
    setSaving(false);
    if (messageFromSave) {
      setError(messageFromSave);
      return;
    }
    setDraft(emptyDraft());
    setAdding(false);
  }

  async function handleUpdate() {
    if (!editingId) {
      return;
    }
    const message = firstContactDetailsError({
      first_name: draft.first_name,
      last_name: draft.last_name,
      email: draft.email,
      phone: draft.phone,
      title: draft.title,
    });
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError("");
    const messageFromSave = await onUpdatePerson(editingId, draft);
    setSaving(false);
    if (messageFromSave) {
      setError(messageFromSave);
      return;
    }
    setDraft(emptyDraft());
    setEditingId(null);
  }

  async function handleDelete(contactId: string) {
    setMenuOpenId(null);
    setSaving(true);
    setError("");
    const message = await onDeletePerson(contactId);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    if (editingId === contactId) {
      setEditingId(null);
      setDraft(emptyDraft());
    }
  }

  return (
    <div className="pb-2">
      {people.length === 0 && !adding ? (
        <p className="pb-2 text-sm text-muted">No people linked yet.</p>
      ) : null}

      <ul className="space-y-3">
        {people.map((person) => {
          const isPrimary = person.id === resolvedPrimaryId;
          const isEditing = editingId === person.id;
          if (isEditing) {
            return (
              <li key={person.id} className="space-y-2 rounded-md border border-border bg-white px-2.5 py-2.5">
                <p className="text-sm font-medium text-foreground">Edit person</p>
                <PersonFormFields
                  draft={draft}
                  setDraft={(updater) => setDraft((current) => updater(current))}
                  setError={setError}
                />
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleUpdate()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(null);
                      setDraft(emptyDraft());
                      setError("");
                    }}
                    className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li key={person.id} className="rounded-md border border-border/70 bg-slate-50/60 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <PersonIcon className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{person.full_name}</p>
                    <select
                      aria-label={`${person.full_name} role`}
                      className="h-7 rounded-md border border-border bg-white px-2 text-xs text-foreground"
                      value={isPrimary ? "primary" : "contact"}
                      onChange={(event) => {
                        if (event.target.value === "primary") {
                          onSetPrimary(person.id);
                        }
                      }}
                    >
                      <option value="primary">Primary</option>
                      <option value="contact">Contact</option>
                    </select>
                    <div className="relative ml-auto" ref={menuOpenId === person.id ? menuRef : undefined}>
                      <button
                        type="button"
                        aria-label={`Edit ${person.full_name}`}
                        aria-expanded={menuOpenId === person.id}
                        disabled={saving || adding}
                        onClick={() =>
                          setMenuOpenId((current) => (current === person.id ? null : person.id))
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted hover:bg-slate-50 hover:text-foreground disabled:opacity-50"
                      >
                        <EditPencilIcon />
                      </button>
                      {menuOpenId === person.id ? (
                        <div className="absolute right-0 z-20 mt-1 min-w-[8.5rem] rounded-md border border-border bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-slate-50"
                            onClick={() => {
                              setMenuOpenId(null);
                              setAdding(false);
                              setEditingId(person.id);
                              setDraft(draftFromPerson(person));
                              setError("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-slate-50"
                            onClick={() => void handleDelete(person.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <MailIcon />
                      <span className={cn(!person.email && "text-muted")}>
                        {person.email || "Add email"}
                      </span>
                      {person.email ? <span className="text-xs text-muted">(Work)</span> : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <PhoneIcon />
                      <span className={cn(!person.phone && "text-muted")}>
                        {person.phone || "Add phone"}
                      </span>
                      {person.phone ? (
                        <span className="text-xs text-muted">
                          (
                          {phoneTypeLabel(
                            phonesForEditor(person.phones, person.phone)[0]?.type ?? "work",
                          )}
                          )
                        </span>
                      ) : null}
                    </div>
                    {person.title ? (
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <TitleIcon />
                        <span>{person.title}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error && !adding && !editingId ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {adding ? (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-white px-2.5 py-2.5">
          <p className="text-sm font-medium text-foreground">New person</p>
          <PersonFormFields
            draft={draft}
            setDraft={(updater) => setDraft((current) => updater(current))}
            setError={setError}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreate()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save person"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setDraft(emptyDraft());
                setError("");
              }}
              className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            disabled={disabled || Boolean(editingId)}
            title={disabled ? disabledReason : undefined}
            onClick={() => {
              setEditingId(null);
              setAdding(true);
              setDraft(emptyDraft());
              setError("");
            }}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add People
          </button>
          {disabled && disabledReason ? (
            <p className="mt-1.5 text-xs text-muted">{disabledReason}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
