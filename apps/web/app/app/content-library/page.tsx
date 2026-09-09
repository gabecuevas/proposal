"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import {
  ConfirmDeleteModal,
  MoveToFolderModal,
  PromptNameModal,
  ShareMembersModal,
  type WorkspaceMemberOption,
} from "@/components/templates/library-modals";
import {
  LibraryViewActionsBar,
  type LibraryViewMode,
} from "@/components/templates/library-view-actions-bar";

const VIEW_KEY = "senddox-content-block-view";

type BlockItem = {
  id: string;
  name: string;
  block_type: string;
  version: number;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
  owner_name: string;
  updated_by_name: string | null;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
};

type FolderItem = {
  id: string;
  name: string;
  parent_id: string | null;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
};

type Breadcrumb = { id: string | null; name: string };
type ModalKind = "new-folder" | "rename" | "move" | "share" | "delete" | null;

function loadViewMode(): LibraryViewMode {
  if (typeof window === "undefined") {
    return "list";
  }
  return window.localStorage.getItem(VIEW_KEY) === "preview" ? "preview" : "list";
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function sharedLabel(shared: Array<{ name: string }>): string {
  if (shared.length === 0) {
    return "Private";
  }
  if (shared.length === 1) {
    return shared[0]?.name ?? "1 person";
  }
  return `${shared.length} people`;
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 7.5A1.5 1.5 0 014.5 6H9l2 2h8.5A1.5 1.5 0 0121 9.5v8A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ContentLibraryPage() {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [name, setName] = useState("Executive Summary");
  const [blockType, setBlockType] = useState("clause");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("list");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<Breadcrumb[]>([{ id: null, name: "Library" }]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionHint, setActionHint] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [shareSeed, setShareSeed] = useState<string[]>([]);
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);

  const currentFolderId = path[path.length - 1]?.id ?? null;

  useEffect(() => {
    setViewMode(loadViewMode());
  }, []);

  function setView(next: LibraryViewMode) {
    setViewMode(next);
    window.localStorage.setItem(VIEW_KEY, next);
  }

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/workspace/members");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      members: Array<{ userId: string; name: string; email: string }>;
    };
    setMembers(payload.members.map((m) => ({ userId: m.userId, name: m.name, email: m.email })));
  }, []);

  const loadLibrary = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("folderId", currentFolderId ?? "root");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const folderParams = new URLSearchParams();
    folderParams.set("parentId", currentFolderId ?? "root");

    const [blocksRes, foldersRes, allFoldersRes] = await Promise.all([
      fetch(`/api/content-blocks?${params.toString()}`),
      fetch(`/api/content-blocks/folders?${folderParams.toString()}`),
      fetch("/api/content-blocks/folders?all=1"),
    ]);

    if (!blocksRes.ok) {
      setError("Failed to load content blocks");
      setLoading(false);
      return;
    }

    const blocksPayload = (await blocksRes.json()) as { blocks: BlockItem[] };
    setItems(blocksPayload.blocks);

    if (foldersRes.ok) {
      const foldersPayload = (await foldersRes.json()) as { folders: FolderItem[] };
      setFolders(foldersPayload.folders);
    }
    if (allFoldersRes.ok) {
      const allPayload = (await allFoldersRes.json()) as { folders: FolderItem[] };
      setAllFolders(allPayload.folders);
    }
    setLoading(false);
  }, [currentFolderId, query]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const selectedBlocks = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected],
  );

  function toggleSelected(id: string) {
    setActionHint("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((item) => item.id)));
  }

  function openFolder(folder: FolderItem) {
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelected(new Set());
  }

  function navigateBreadcrumb(index: number) {
    setPath((prev) => prev.slice(0, index + 1));
    setSelected(new Set());
  }

  function ensureSelectionMode() {
    setSelectionMode(true);
    setActionHint("Select content blocks with the checkboxes, then choose an action.");
  }

  function requireSelection(min = 1, max?: number): BlockItem[] | null {
    setSelectionMode(true);
    if (selectedBlocks.length < min) {
      setActionHint(
        min === 1
          ? "Select at least one content block with the checkboxes, then try again."
          : `Select ${min} content blocks, then try again.`,
      );
      setError("");
      return null;
    }
    if (max !== undefined && selectedBlocks.length > max) {
      setActionHint(max === 1 ? "Select a single content block for this action." : `Select at most ${max}.`);
      setError("");
      return null;
    }
    setActionHint("");
    return selectedBlocks;
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/content-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          block_type: blockType,
          folder_id: currentFolderId,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create content block");
      }
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  async function createFolder(folderName: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/content-blocks/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, parentId: currentFolderId }),
      });
      if (!response.ok) {
        throw new Error("Could not create folder");
      }
      setModal(null);
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder");
    } finally {
      setBusy(false);
    }
  }

  function openAction(kind: ModalKind) {
    if (kind === "new-folder") {
      setModal("new-folder");
      return;
    }
    if (kind === "rename") {
      const blocks = requireSelection(1, 1);
      if (!blocks?.[0]) {
        return;
      }
      setRenameTarget({ id: blocks[0].id, name: blocks[0].name });
      setModal("rename");
      return;
    }
    if (kind === "share") {
      const blocks = requireSelection(1, 1);
      if (!blocks?.[0]) {
        return;
      }
      setShareSeed(blocks[0].shared_with.map((s) => s.user_id));
      setShareFolderId(null);
      setModal("share");
      return;
    }
    if (!requireSelection(1)) {
      return;
    }
    setModal(kind);
  }

  async function renameBlock(nextName: string) {
    if (!renameTarget) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/content-blocks/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!response.ok) {
        throw new Error("Could not rename content block");
      }
      setModal(null);
      setRenameTarget(null);
      setSelected(new Set());
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateSelected() {
    const blocks = requireSelection(1);
    if (!blocks) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const block of blocks) {
        const response = await fetch(`/api/content-blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duplicate: true }),
        });
        if (!response.ok) {
          throw new Error(`Could not duplicate “${block.name}”`);
        }
      }
      setSelected(new Set());
      setActionHint("");
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate");
    } finally {
      setBusy(false);
    }
  }

  async function moveSelected(folderId: string | null) {
    const blocks = requireSelection(1);
    if (!blocks) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const block of blocks) {
        const response = await fetch(`/api/content-blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_id: folderId }),
        });
        if (!response.ok) {
          throw new Error(`Could not move “${block.name}”`);
        }
      }
      setModal(null);
      setSelected(new Set());
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move");
    } finally {
      setBusy(false);
    }
  }

  async function shareSelected(userIds: string[]) {
    setBusy(true);
    setError("");
    try {
      if (shareFolderId) {
        const response = await fetch("/api/content-blocks/folders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: shareFolderId, shareUserIds: userIds }),
        });
        if (!response.ok) {
          throw new Error("Could not update folder sharing");
        }
      } else {
        const block = selectedBlocks[0];
        if (!block) {
          return;
        }
        const response = await fetch(`/api/content-blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareUserIds: userIds }),
        });
        if (!response.ok) {
          throw new Error("Could not update sharing");
        }
      }
      setModal(null);
      setShareFolderId(null);
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sharing");
    } finally {
      setBusy(false);
    }
  }

  function openFolderShare(folder: FolderItem, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setShareFolderId(folder.id);
    setShareSeed(folder.shared_with.map((s) => s.user_id));
    setModal("share");
  }

  async function deleteSelected() {
    const blocks = requireSelection(1);
    if (!blocks) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const block of blocks) {
        const response = await fetch(`/api/content-blocks/${block.id}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error(`Could not delete “${block.name}”`);
        }
      }
      setModal(null);
      setSelected(new Set());
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetPage
      error={error}
      toolbar={
        <>
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Block name"
          />
          <input
            className="h-10 w-40 rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
            value={blockType}
            onChange={(event) => setBlockType(event.target.value)}
            placeholder="Block type"
          />
          <div className="relative w-full min-w-0 sm:max-w-xs">
            <input
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search blocks…"
              aria-label="Search content blocks"
            />
          </div>
          <p className="text-sm text-muted">
            {items.length} {items.length === 1 ? "block" : "blocks"}
            {folders.length > 0 ? ` · ${folders.length} folders` : ""}
          </p>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-40"
          >
            + Add block
          </button>
        </>
      }
    >
      <LibraryViewActionsBar
        viewMode={viewMode}
        onViewModeChange={setView}
        showNewFolder
        onNewFolder={() => openAction("new-folder")}
        selectionMode={selectionMode}
        selectionCount={selected.size}
        menuHint={
          selectionMode && selected.size === 0
            ? "Select items below, then choose an action."
            : undefined
        }
        onActionsOpen={ensureSelectionMode}
        onClearSelection={() => {
          setSelectionMode(false);
          setSelected(new Set());
          setActionHint("");
        }}
        onDuplicate={() => void duplicateSelected()}
        onMove={() => openAction("move")}
        onShare={() => openAction("share")}
        onRename={() => openAction("rename")}
        onDelete={() => openAction("delete")}
        leading={
          <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
            {path.map((crumb, index) => {
              const isLast = index === path.length - 1;
              return (
                <span key={`${crumb.id ?? "root"}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? <span className="text-muted">/</span> : null}
                  {isLast ? (
                    <span className="font-medium text-foreground">{crumb.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigateBreadcrumb(index)}
                      className="text-muted hover:text-foreground"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        }
      />

      {actionHint ? (
        <p className="border-b border-border bg-slate-50 px-4 py-2 text-sm text-muted">{actionHint}</p>
      ) : null}

      {viewMode === "list" ? (
        <SheetTable
          minWidth="56rem"
          empty={
            !loading && items.length === 0 && folders.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No content blocks yet.</p>
            ) : null
          }
        >
          <thead>
            <tr>
              {selectionMode ? (
                <th className={sheetTh("w-10")}>
                  <input
                    type="checkbox"
                    data-library-select
                    aria-label="Select all content blocks"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              ) : null}
              <th className={sheetTh()}>Document Title</th>
              <th className={sheetTh()}>Date Added</th>
              <th className={sheetTh()}>Last Modified</th>
              <th className={sheetTh()}>Shared</th>
              <th className={sheetTh()}>Type</th>
              <th className={sheetTh()}>Owner</th>
              <th className={sheetTh()}>Last Modified By</th>
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <tr key={folder.id} className={sheetTr()}>
                {selectionMode ? <td className={sheetTd()} /> : null}
                <td className={sheetTd("font-medium text-foreground")}>
                  <button
                    type="button"
                    onClick={() => openFolder(folder)}
                    className="inline-flex items-center gap-2 text-left hover:text-primary"
                  >
                    <FolderIcon className="text-amber-700" />
                    {folder.name}
                  </button>
                </td>
                <td className={sheetTd()}>—</td>
                <td className={sheetTd()}>—</td>
                <td className={sheetTd()}>
                  <button
                    type="button"
                    onClick={(event) => openFolderShare(folder, event)}
                    className="hover:text-foreground hover:underline"
                  >
                    {sharedLabel(folder.shared_with)}
                  </button>
                </td>
                <td className={sheetTd()}>Folder</td>
                <td className={sheetTd()}>—</td>
                <td className={sheetTd()}>—</td>
              </tr>
            ))}
            {items.map((item) => {
              const checked = selected.has(item.id);
              return (
                <tr key={item.id} className={sheetTr(checked ? "bg-slate-50/90" : undefined)}>
                  {selectionMode ? (
                    <td className={sheetTd()}>
                      <input
                        type="checkbox"
                        data-library-select
                        aria-label={`Select ${item.name}`}
                        checked={checked}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </td>
                  ) : null}
                  <td className={sheetTd("font-medium text-foreground")}>
                    {item.name}
                    <span className="ml-2 text-xs text-muted">v{item.version}</span>
                  </td>
                  <td className={sheetTd()}>{formatDate(item.created_at)}</td>
                  <td className={sheetTd()}>{formatDate(item.updated_at)}</td>
                  <td className={sheetTd()}>{sharedLabel(item.shared_with)}</td>
                  <td className={sheetTd()}>{item.block_type}</td>
                  <td className={sheetTd()}>{item.owner_name}</td>
                  <td className={sheetTd()}>{item.updated_by_name ?? item.owner_name}</td>
                </tr>
              );
            })}
          </tbody>
        </SheetTable>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-4 p-4">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => openFolder(folder)}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex aspect-[4/5] items-center justify-center bg-amber-50 text-amber-800">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M3 7.5A1.5 1.5 0 014.5 6H9l2 2h8.5A1.5 1.5 0 0121 9.5v8A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-10z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="border-t border-border p-3">
                <p className="truncate font-semibold text-foreground">{folder.name}</p>
                <p className="mt-0.5 text-sm text-muted">{sharedLabel(folder.shared_with)}</p>
              </div>
            </button>
          ))}
          {items.map((item) => {
            const checked = selected.has(item.id);
            return (
              <div
                key={item.id}
                className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
              >
                <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 px-4 text-center">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.block_type} · v{item.version}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border p-3">
                  <p className="truncate text-sm text-muted">{item.owner_name}</p>
                </div>
                <label
                  data-library-select
                  className="absolute bottom-3 right-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-border bg-white/95 shadow-sm"
                >
                  <input
                    type="checkbox"
                    data-library-select
                    className="h-3.5 w-3.5"
                    aria-label={`Select ${item.name}`}
                    checked={checked}
                    onChange={() => {
                      setSelectionMode(true);
                      toggleSelected(item.id);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {!loading && viewMode === "preview" && items.length === 0 && folders.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No content blocks yet.</p>
      ) : null}

      <PromptNameModal
        open={modal === "new-folder"}
        title="New folder"
        label="Folder name"
        initialValue="Untitled folder"
        confirmLabel="Create"
        busy={busy}
        onClose={() => setModal(null)}
        onConfirm={createFolder}
      />
      <PromptNameModal
        open={modal === "rename"}
        title="Rename content block"
        label="Document title"
        initialValue={renameTarget?.name ?? ""}
        confirmLabel="Rename"
        busy={busy}
        onClose={() => {
          setModal(null);
          setRenameTarget(null);
        }}
        onConfirm={renameBlock}
      />
      <MoveToFolderModal
        open={modal === "move"}
        folders={allFolders}
        busy={busy}
        onClose={() => setModal(null)}
        onConfirm={moveSelected}
      />
      <ShareMembersModal
        open={modal === "share"}
        members={members}
        selectedUserIds={shareSeed}
        busy={busy}
        onClose={() => {
          setModal(null);
          setShareFolderId(null);
        }}
        onConfirm={shareSelected}
      />
      <ConfirmDeleteModal
        open={modal === "delete"}
        count={selectedBlocks.length}
        noun="content block"
        busy={busy}
        onClose={() => setModal(null)}
        onConfirm={deleteSelected}
      />
    </SheetPage>
  );
}
