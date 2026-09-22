"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolveCompanyAssociation } from "@/lib/crm/resolve-company-association";

export type NewContactCreated = {
  id: string;
  full_name: string;
  email: string;
  company_name?: string | null;
};

type Props = {
  open: boolean;
  source?: string;
  onClose: () => void;
  onCreated: (contact: NewContactCreated) => void;
};

export function NewContactModal({
  open,
  source = "document-workflow",
  onClose,
  onCreated,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFirstName("");
    setLastName("");
    setEmail("");
    setCompanyName("");
    setPhone("");
    setError("");
    setBusy(false);
    const id = window.setTimeout(() => firstRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open]);

  async function submit() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("First name, last name, and email are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const trimmedCompany = companyName.trim();
      const company = trimmedCompany
        ? await resolveCompanyAssociation(trimmedCompany, "", {
            phone: phone.trim() || undefined,
          })
        : { company_id: null as string | null, company_name: null as string | null };

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company_name: company.company_name ?? (trimmedCompany || undefined),
          company_id: company.company_id ?? undefined,
          source,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(data.message || data.error || "Could not create contact");
      }
      const data = (await response.json()) as { contact?: NewContactCreated };
      if (!data.contact) {
        throw new Error("Unexpected response");
      }
      onCreated({
        id: data.contact.id,
        full_name: data.contact.full_name,
        email: data.contact.email,
        company_name:
          data.contact.company_name ?? company.company_name ?? (trimmedCompany || null),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create contact");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 pt-24"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-contact-modal-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconPerson className="h-4 w-4" />
            </span>
            <div>
              <h2 id="new-contact-modal-title" className="text-sm font-semibold text-foreground">
                New Contact
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Adds a Person in CRM (and Company when provided). Logged with who added them and when.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <form
          className="space-y-3 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel icon={<IconPerson className="h-3.5 w-3.5" />} label="First name">
              <input
                ref={firstRef}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                disabled={busy}
                required
              />
            </FieldLabel>
            <FieldLabel icon={<IconPerson className="h-3.5 w-3.5" />} label="Last name">
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                disabled={busy}
                required
              />
            </FieldLabel>
          </div>
          <FieldLabel icon={<IconMail className="h-3.5 w-3.5" />} label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
              disabled={busy}
              required
            />
          </FieldLabel>
          <FieldLabel icon={<IconBuilding className="h-3.5 w-3.5" />} label="Company">
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Optional — links or creates a Company"
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
              disabled={busy}
            />
          </FieldLabel>
          <FieldLabel icon={<IconPhone className="h-3.5 w-3.5" />} label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
              disabled={busy}
            />
          </FieldLabel>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
            >
              <IconPerson className="h-3.5 w-3.5" />
              {busy ? "Saving…" : "Add to CRM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      <span className="mb-1 inline-flex items-center gap-1.5">
        <span className="text-muted/80" aria-hidden>
          {icon}
        </span>
        {label}
      </span>
      {children}
    </label>
  );
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.5c1.6-3.2 4-4.75 6.5-4.75s4.9 1.55 6.5 4.75" strokeLinecap="round" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path d="M4 20V6.5A1.5 1.5 0 015.5 5H12v15H4zM12 20V9h6.5A1.5 1.5 0 0120 10.5V20h-8z" />
      <path d="M7 9h2M7 12h2M7 15h2M15 12h2M15 15h2" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path
        d="M8.5 4.5h2.2l1.1 3.2-1.4 1.1a11.5 11.5 0 005.3 5.3l1.1-1.4 3.2 1.1v2.2a1.5 1.5 0 01-1.5 1.5A13.5 13.5 0 017 6a1.5 1.5 0 011.5-1.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
