"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  resolveCompanyAssociation,
  searchCompanies,
  type CompanySearchResult,
} from "@/lib/crm/resolve-company-association";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findContactByEmail(email: string): Promise<NewContactCreated | null> {
  const params = new URLSearchParams({ q: email, limit: "10" });
  const response = await fetch(`/api/contacts?${params.toString()}`);
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { contacts?: NewContactCreated[] };
  const target = email.toLowerCase();
  return payload.contacts?.find((contact) => contact.email.trim().toLowerCase() === target) ?? null;
}

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
  const [existingContact, setExistingContact] = useState<NewContactCreated | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [companyMatches, setCompanyMatches] = useState<CompanySearchResult[]>([]);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
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
    setExistingContact(null);
    setSelectedCompany(null);
    setCompanyMatches([]);
    setCompanyMenuOpen(false);
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

  useEffect(() => {
    const value = email.trim();
    if (!open || !EMAIL_PATTERN.test(value)) {
      setExistingContact(null);
      setCheckingEmail(false);
      return;
    }
    let cancelled = false;
    setCheckingEmail(true);
    const id = window.setTimeout(() => {
      void findContactByEmail(value)
        .catch(() => null)
        .then((match) => {
          if (!cancelled) {
            setExistingContact(match);
            setCheckingEmail(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [email, open]);

  useEffect(() => {
    const value = companyName.trim();
    if (!open || !value || selectedCompany?.name === value) {
      setCompanyMatches([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      void searchCompanies(value, 6)
        .catch(() => [])
        .then((matches) => {
          if (!cancelled) {
            setCompanyMatches(matches);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [companyName, open, selectedCompany]);

  const exactCompany =
    selectedCompany ??
    companyMatches.find((company) => company.name.trim().toLowerCase() === companyName.trim().toLowerCase()) ??
    null;

  function chooseCompany(company: CompanySearchResult) {
    setSelectedCompany(company);
    setCompanyName(company.name);
    setCompanyMatches([]);
    setCompanyMenuOpen(false);
  }

  function selectExistingContact() {
    if (!existingContact) {
      return;
    }
    onCreated(existingContact);
    onClose();
  }

  async function submit() {
    const trimmedEmail = email.trim();
    const trimmedCompany = companyName.trim();
    if (!firstName.trim() || !lastName.trim() || !trimmedEmail || !trimmedCompany) {
      setError("First name, last name, email, and company are required");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const duplicate = existingContact ?? (await findContactByEmail(trimmedEmail).catch(() => null));
      if (duplicate) {
        setExistingContact(duplicate);
        throw new Error("A contact with this email already exists. Use the existing contact instead.");
      }
      const company = await resolveCompanyAssociation(trimmedCompany, exactCompany?.id ?? "", {
        phone: phone.trim() || undefined,
      });

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          company_name: exactCompany?.name ?? company.company_name ?? trimmedCompany,
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
        company_name: data.contact.company_name ?? company.company_name ?? trimmedCompany,
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
                Adds a Person in CRM and links their Company. Logged with who added them and when.
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
            <FieldLabel icon={<IconPerson className="h-3.5 w-3.5" />} label="First name" required>
              <input
                ref={firstRef}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                disabled={busy}
                required
              />
            </FieldLabel>
            <FieldLabel icon={<IconPerson className="h-3.5 w-3.5" />} label="Last name" required>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                disabled={busy}
                required
              />
            </FieldLabel>
          </div>
          <div>
            <FieldLabel icon={<IconMail className="h-3.5 w-3.5" />} label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary/40 ${
                  existingContact ? "border-amber-400" : "border-border"
                }`}
                disabled={busy}
                required
                aria-invalid={Boolean(existingContact)}
              />
            </FieldLabel>
            {checkingEmail ? <p className="mt-1 text-xs text-muted">Checking CRM…</p> : null}
            {existingContact && !checkingEmail ? (
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                <div className="min-w-0 text-xs text-amber-900">
                  <p className="font-medium">This email already belongs to a contact.</p>
                  <p className="truncate">
                    {existingContact.full_name}
                    {existingContact.company_name ? ` · ${existingContact.company_name}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={selectExistingContact}
                  className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-95"
                >
                  Use this contact
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <FieldLabel icon={<IconBuilding className="h-3.5 w-3.5" />} label="Company" required>
              <input
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value);
                  setSelectedCompany(null);
                  setCompanyMenuOpen(true);
                }}
                onFocus={() => setCompanyMenuOpen(true)}
                onBlur={() => window.setTimeout(() => setCompanyMenuOpen(false), 150)}
                placeholder="Search existing companies or add a new one"
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                disabled={busy}
                required
                autoComplete="off"
                role="combobox"
                aria-expanded={companyMenuOpen && companyMatches.length > 0}
                aria-controls="new-contact-company-options"
              />
            </FieldLabel>
            {companyMenuOpen && companyMatches.length > 0 ? (
              <ul
                id="new-contact-company-options"
                role="listbox"
                className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg"
              >
                {companyMatches.map((company) => (
                  <li key={company.id} role="option" aria-selected={exactCompany?.id === company.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseCompany(company)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-slate-100"
                    >
                      <span className="truncate text-foreground">{company.name}</span>
                      {company.city || company.industry ? (
                        <span className="shrink-0 text-xs text-muted">{company.city || company.industry}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {companyName.trim() ? (
              <p className="mt-1 text-xs text-muted">
                {exactCompany
                  ? `Links to existing company “${exactCompany.name}”.`
                  : "A new company will be added to the CRM."}
              </p>
            ) : null}
          </div>
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
              disabled={busy || Boolean(existingContact)}
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
  required = false,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      <span className="mb-1 inline-flex items-center gap-1.5">
        <span className="text-muted/80" aria-hidden>
          {icon}
        </span>
        {label}
        {required ? (
          <span className="text-red-600" aria-hidden>
            *
          </span>
        ) : null}
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
