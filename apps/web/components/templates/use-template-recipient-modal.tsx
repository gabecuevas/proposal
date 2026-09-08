"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ContactOption = {
  id: string;
  full_name: string;
  email: string;
};

type Props = {
  open: boolean;
  templateId: string;
  templateName: string;
  onClose: () => void;
};

type Mode = "select" | "create";

export function UseTemplateRecipientModal({ open, templateId, templateName, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("select");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode("select");
    setQuery("");
    setSelectedContactId("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setError("");
    setBusy(false);
  }, [open, templateId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingContacts(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (query.trim()) {
          params.set("q", query.trim());
        }
        const response = await fetch(`/api/contacts?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Could not load contacts");
        }
        const data = (await response.json()) as { contacts?: ContactOption[] };
        if (!cancelled) {
          setContacts(data.contacts ?? []);
        }
      } catch {
        if (!cancelled) {
          setContacts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingContacts(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, query]);

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

  const createDocument = useCallback(
    async (recipient: { name: string; email: string; contactId?: string | null }) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/documents/from-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            recipient,
          }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Could not create document");
        }
        const data = (await response.json()) as { document?: { id: string } };
        const id = data.document?.id;
        if (!id) {
          throw new Error("Unexpected response");
        }
        router.push(`/app/documents/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create document");
        setBusy(false);
      }
    },
    [router, templateId],
  );

  async function onSubmitSelect() {
    const contact = contacts.find((item) => item.id === selectedContactId);
    if (!contact) {
      setError("Select a recipient");
      return;
    }
    await createDocument({
      name: contact.full_name,
      email: contact.email,
      contactId: contact.id,
    });
  }

  async function onSubmitCreate() {
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    const nextEmail = email.trim();
    if (!firstName.trim() || !lastName.trim() || !nextEmail) {
      setError("First name, last name, and email are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const contactResponse = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: nextEmail,
          source: "template-recipient",
        }),
      });
      let contactId: string | null = null;
      if (contactResponse.ok) {
        const contactData = (await contactResponse.json()) as { contact?: { id: string } };
        contactId = contactData.contact?.id ?? null;
      }
      await createDocument({
        name,
        email: nextEmail,
        contactId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create recipient");
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-24"
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
        aria-labelledby="use-template-recipient-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="use-template-recipient-title" className="text-sm font-semibold text-foreground">
              Add recipient as signer
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted">{templateName}</p>
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

        <div className="border-b border-border px-4 py-2">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                mode === "select" ? "bg-white text-foreground shadow-sm" : "text-muted"
              }`}
              onClick={() => {
                setMode("select");
                setError("");
              }}
              disabled={busy}
            >
              Select existing
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                mode === "create" ? "bg-white text-foreground shadow-sm" : "text-muted"
              }`}
              onClick={() => {
                setMode("create");
                setError("");
              }}
              disabled={busy}
            >
              Create new
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          {mode === "select" ? (
            <>
              <label className="block text-xs font-medium text-muted">
                Search contacts
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  placeholder="Name or email"
                  disabled={busy}
                />
              </label>
              <div className="max-h-56 overflow-auto rounded-md border border-border">
                {loadingContacts ? (
                  <p className="px-3 py-4 text-sm text-muted">Loading contacts…</p>
                ) : contacts.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">No contacts found. Create a new recipient.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {contacts.map((contact) => {
                      const selected = selectedContactId === contact.id;
                      return (
                        <li key={contact.id}>
                          <button
                            type="button"
                            className={`flex w-full flex-col px-3 py-2.5 text-left text-sm ${
                              selected ? "bg-primary/10" : "hover:bg-slate-50"
                            }`}
                            onClick={() => setSelectedContactId(contact.id)}
                            disabled={busy}
                          >
                            <span className="font-medium text-foreground">{contact.full_name}</span>
                            <span className="text-xs text-muted">{contact.email}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="grid gap-3">
              <label className="block text-xs font-medium text-muted">
                First name
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  disabled={busy}
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Last name
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  disabled={busy}
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  disabled={busy}
                />
              </label>
            </div>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
            disabled={busy || (mode === "select" && !selectedContactId)}
            onClick={() => {
              if (mode === "select") {
                void onSubmitSelect();
              } else {
                void onSubmitCreate();
              }
            }}
          >
            {busy ? "Opening document…" : "Continue to document"}
          </button>
        </div>
      </div>
    </div>
  );
}
