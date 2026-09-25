"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type ContactMembership = {
  workspaceId: string;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export type ActionContact = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  disabledAt: string | null;
  archivedAt: string | null;
  billingFrozen: boolean;
  memberships: ContactMembership[];
};

export type MenuAction =
  | "sudo"
  | "edit"
  | "disable"
  | "enable"
  | "freeze"
  | "unfreeze"
  | "archive"
  | "unarchive"
  | "delete";

type MenuItem = { action: MenuAction; label: string; danger?: boolean; singleOnly?: boolean };

const MENU_GROUPS: MenuItem[][] = [
  [
    { action: "sudo", label: "Sudo user", singleOnly: true },
    { action: "edit", label: "Edit", singleOnly: true },
  ],
  [
    { action: "disable", label: "Disable" },
    { action: "enable", label: "Enable" },
  ],
  [
    { action: "freeze", label: "Freeze billing" },
    { action: "unfreeze", label: "Unfreeze billing" },
  ],
  [
    { action: "archive", label: "Archive" },
    { action: "unarchive", label: "Unarchive" },
  ],
  [{ action: "delete", label: "Delete…", danger: true }],
];

function itemDisabledReason(item: MenuItem, selected: ActionContact[]): string | null {
  if (selected.length === 0) {
    return "Select accounts first";
  }
  if (item.singleOnly && selected.length !== 1) {
    return "Select exactly one account";
  }
  switch (item.action) {
    case "sudo":
      if (selected[0]!.isPlatformAdmin) return "Admins cannot be sudo'd";
      if (selected[0]!.disabledAt) return "Enable the account first";
      return null;
    case "disable":
      return selected.some((c) => !c.disabledAt) ? null : "Already disabled";
    case "enable":
      return selected.some((c) => c.disabledAt) ? null : "No disabled accounts selected";
    case "freeze":
      return selected.some((c) => !c.billingFrozen) ? null : "Already frozen";
    case "unfreeze":
      return selected.some((c) => c.billingFrozen) ? null : "No frozen accounts selected";
    case "archive":
      return selected.some((c) => !c.archivedAt) ? null : "Already archived";
    case "unarchive":
      return selected.some((c) => c.archivedAt) ? null : "No archived accounts selected";
    default:
      return null;
  }
}

export function ActionsMenu({
  selected,
  onAction,
}: {
  selected: ActionContact[];
  onAction: (action: MenuAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-none bg-primary px-3 py-1.5 text-sm text-primary-foreground"
      >
        Actions{selected.length ? ` (${selected.length})` : ""} ▾
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-56 border border-border bg-surface py-1 text-sm shadow-lg"
        >
          {MENU_GROUPS.map((group, index) => (
            <div key={index} className={index > 0 ? "border-t border-border py-1" : "py-1"}>
              {group.map((item) => {
                const reason = itemDisabledReason(item, selected);
                return (
                  <button
                    key={item.action}
                    type="button"
                    role="menuitem"
                    disabled={Boolean(reason)}
                    title={reason ?? undefined}
                    onClick={() => {
                      setOpen(false);
                      onAction(item.action);
                    }}
                    className={`block w-full px-3 py-1.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${
                      item.danger ? "text-red-600" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md border border-border bg-surface p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <div className="mt-3 space-y-3 text-sm">{children}</div>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-none border border-border px-2 py-1.5 text-sm";

export function EditContactDialog({
  contact,
  onClose,
  onSaved,
}: {
  contact: ActionContact;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const firstMembership = contact.memberships[0] ?? null;
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [workspaceId, setWorkspaceId] = useState(firstMembership?.workspaceId ?? "");
  const membership = contact.memberships.find((m) => m.workspaceId === workspaceId) ?? null;
  const [company, setCompany] = useState(firstMembership?.workspaceName ?? "");
  const [type, setType] = useState<"OWNER" | "USER">(firstMembership?.role === "OWNER" ? "OWNER" : "USER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function selectWorkspace(id: string) {
    setWorkspaceId(id);
    const next = contact.memberships.find((m) => m.workspaceId === id);
    setCompany(next?.workspaceName ?? "");
    setType(next?.role === "OWNER" ? "OWNER" : "USER");
  }

  async function save() {
    setSaving(true);
    setError("");
    const body: Record<string, string> = {};
    if (name.trim() !== contact.name) body.name = name;
    if (email.trim().toLowerCase() !== contact.email) body.email = email;
    if (membership) {
      if (company.trim() !== membership.workspaceName) body.company = company;
      const currentType = membership.role === "OWNER" ? "OWNER" : "USER";
      if (type !== currentType) body.type = type;
      if (body.company || body.type) body.workspaceId = membership.workspaceId;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    const res = await fetch(`/api/admin/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string }; googleUnlinked?: boolean }
      | null;
    setSaving(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save changes");
      return;
    }
    onSaved(
      data?.googleUnlinked
        ? "Saved. Google sign-in was unlinked because the email changed; the user can sign in with their password."
        : "Saved changes",
    );
  }

  return (
    <Modal title={`Edit ${contact.email}`} onClose={onClose}>
      <label className="block">
        <span className="text-xs font-medium text-muted">Name</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted">Email</span>
        <input
          className={inputClass}
          type="email"
          value={email}
          disabled={contact.isPlatformAdmin}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {contact.memberships.length > 1 ? (
        <label className="block">
          <span className="text-xs font-medium text-muted">Workspace</span>
          <select className={inputClass} value={workspaceId} onChange={(e) => selectWorkspace(e.target.value)}>
            {contact.memberships.map((m) => (
              <option key={m.workspaceId} value={m.workspaceId}>
                {m.workspaceName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {membership ? (
        <>
          <label className="block">
            <span className="text-xs font-medium text-muted">Company (renames the workspace for all members)</span>
            <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Type</span>
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value === "OWNER" ? "OWNER" : "USER")}
            >
              <option value="OWNER">Account Owner</option>
              <option value="USER">User</option>
            </select>
            <span className="mt-1 block text-xs text-muted">
              Making this user the Account Owner moves the current owner to Admin. Demoting an owner
              promotes the next admin or member.
            </span>
          </label>
        </>
      ) : (
        <p className="text-xs text-muted">This user has no workspace, so Company and Type can’t be edited.</p>
      )}
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-none border border-border px-3 py-1.5">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-none bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

const CONFIRM_COPY: Record<
  Exclude<MenuAction, "edit">,
  { title: string; body: string; confirm: string; danger?: boolean }
> = {
  sudo: {
    title: "Sudo into this account?",
    body: "You will be signed in as this user for up to 1 hour. Everything you do is saved as the user, and each change is also recorded in the admin audit log under your account. Admin tools are unavailable until you exit sudo.",
    confirm: "Start sudo",
  },
  disable: {
    title: "Disable access",
    body: "Disabled users can’t sign in, and their existing sessions stop working. Their data is kept and you can re-enable them at any time.",
    confirm: "Disable",
    danger: true,
  },
  enable: {
    title: "Enable access",
    body: "These users will be able to sign in again.",
    confirm: "Enable",
  },
  freeze: {
    title: "Freeze billing",
    body: "Workspaces owned by these users are marked as billing-frozen so they won’t be charged once billing is turned on. Access is not affected.",
    confirm: "Freeze billing",
  },
  unfreeze: {
    title: "Unfreeze billing",
    body: "Workspaces owned by these users will be billed normally once billing is turned on.",
    confirm: "Unfreeze",
  },
  archive: {
    title: "Archive accounts",
    body: "Archived accounts are hidden from the main Contacts list. Use the Archived filter to see or restore them. Access is not affected; disable them too if needed.",
    confirm: "Archive",
  },
  unarchive: {
    title: "Unarchive accounts",
    body: "These accounts will show in the main Contacts list again.",
    confirm: "Unarchive",
  },
  delete: {
    title: "Delete accounts permanently",
    body: "This permanently deletes the selected users and can’t be undone. In shared workspaces, ownership passes to the next admin or member.",
    confirm: "Delete permanently",
    danger: true,
  },
};

export function ConfirmActionDialog({
  action,
  selected,
  busy,
  onCancel,
  onConfirm,
}: {
  action: Exclude<MenuAction, "edit">;
  selected: ActionContact[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (options: { reason: string; purgeWorkspaces: boolean; confirm: string }) => void;
}) {
  const copy = CONFIRM_COPY[action];
  const [reason, setReason] = useState("");
  const [purgeWorkspaces, setPurgeWorkspaces] = useState(true);
  const [typed, setTyped] = useState("");
  const blocked = action === "delete" && typed !== "DELETE";

  return (
    <Modal title={copy.title} onClose={onCancel}>
      <p className="text-muted">{copy.body}</p>
      <ul className="max-h-32 overflow-auto border border-border px-3 py-2 text-xs">
        {selected.map((c) => (
          <li key={c.id}>
            {c.name} · {c.email}
          </li>
        ))}
      </ul>
      {action === "disable" ? (
        <label className="block">
          <span className="text-xs font-medium text-muted">Reason (internal, optional)</span>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      ) : null}
      {action === "delete" ? (
        <>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={purgeWorkspaces}
              onChange={(e) => setPurgeWorkspaces(e.target.checked)}
            />
            <span>
              Purge the entire account: also delete workspaces where this user is the only member,
              including their documents, templates, and contacts.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Type DELETE to confirm</span>
            <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
        </>
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-none border border-border px-3 py-1.5">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || blocked}
          onClick={() => onConfirm({ reason, purgeWorkspaces, confirm: typed })}
          className={`rounded-none px-3 py-1.5 text-white disabled:opacity-50 ${
            copy.danger ? "bg-red-600" : "bg-primary"
          }`}
        >
          {busy ? "Working…" : copy.confirm}
        </button>
      </div>
    </Modal>
  );
}
