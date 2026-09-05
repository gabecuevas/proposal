"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type WorkspaceMemberOption = {
  userId: string;
  name: string;
  email: string;
};

function ModalShell({
  open,
  title,
  onClose,
  children,
  busy,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
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
        aria-labelledby="library-modal-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="library-modal-title" className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-40"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function PromptNameModal({
  open,
  title,
  label,
  initialValue,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValue(initialValue);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, [initialValue, open]);

  return (
    <ModalShell open={open} title={title} onClose={onClose} busy={busy}>
      <label className="block text-sm text-foreground">
        <span className="mb-1.5 block text-muted">{label}</span>
        <input
          ref={inputRef}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim() && !busy) {
              void onConfirm(value.trim());
            }
          }}
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm text-muted hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void onConfirm(value.trim())}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

export function ConfirmDeleteModal({
  open,
  count,
  busy,
  noun = "template",
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy?: boolean;
  noun?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const label = count === 1 ? noun : `${noun}s`;
  return (
    <ModalShell open={open} title={`Delete ${label}`} onClose={onClose} busy={busy}>
      <p className="text-sm text-muted">
        Delete {count === 1 ? `this ${noun}` : `${count} ${label}`}? This cannot be undone.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm text-muted hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

export function MoveToFolderModal({
  open,
  folders,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  folders: Array<{ id: string; name: string; parent_id: string | null }>;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (folderId: string | null) => void | Promise<void>;
}) {
  const [target, setTarget] = useState<string>("root");

  useEffect(() => {
    if (open) {
      setTarget("root");
    }
  }, [open]);

  const labelFor = (folder: { id: string; name: string; parent_id: string | null }) => {
    const parts: string[] = [folder.name];
    let parentId = folder.parent_id;
    const byId = new Map(folders.map((f) => [f.id, f]));
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) {
        break;
      }
      parts.unshift(parent.name);
      parentId = parent.parent_id;
    }
    return parts.join(" / ");
  };

  return (
    <ModalShell open={open} title="Move to folder" onClose={onClose} busy={busy}>
      <label className="block text-sm text-foreground">
        <span className="mb-1.5 block text-muted">Destination</span>
        <select
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
          value={target}
          disabled={busy}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="root">Library (root)</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {labelFor(folder)}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm text-muted hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm(target === "root" ? null : target)}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Move
        </button>
      </div>
    </ModalShell>
  );
}

export function ShareMembersModal({
  open,
  members,
  selectedUserIds,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  members: WorkspaceMemberOption[];
  selectedUserIds: string[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: (userIds: string[]) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUserIds));

  useEffect(() => {
    if (open) {
      setSelected(new Set(selectedUserIds));
    }
  }, [open, selectedUserIds]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  return (
    <ModalShell open={open} title="Share with team" onClose={onClose} busy={busy}>
      <p className="mb-3 text-sm text-muted">
        Choose workspace members who can access this item. Sharing stays inside your account.
      </p>
      <ul className="max-h-64 space-y-1 overflow-auto rounded-md border border-border">
        {members.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted">No other team members yet.</li>
        ) : (
          members.map((member) => {
            const checked = selected.has(member.userId);
            return (
              <li key={member.userId}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggle(member.userId)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {member.name}
                    </span>
                    <span className="block truncate text-xs text-muted">{member.email}</span>
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm text-muted hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm([...selected])}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Save sharing
        </button>
      </div>
    </ModalShell>
  );
}
