"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import { UploadDropzone } from "@/components/templates/upload-dropzone";
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
import type { EditorDoc } from "@/lib/editor/types";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  pageCountFromEditor,
  templateSubtitleFromTags,
  templateThumbnailKey,
} from "@/lib/ui/template-meta";

const FAVORITES_KEY = "senddox-template-favorites";
const VIEW_KEY = "senddox-template-view";
const SUGGESTED_LIMIT = 8;

type TemplateKind = "PDF" | "DOCX" | "Custom";

type TemplateItem = {
  id: string;
  name: string;
  tags: string[];
  editor_json: EditorDoc;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
  owner_name: string;
  updated_by_name: string | null;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
  kind: TemplateKind;
};

type FolderItem = {
  id: string;
  name: string;
  parent_id: string | null;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
};

type Breadcrumb = { id: string | null; name: string };

const TABS = [
  { id: "suggested", label: "Suggested" },
  { id: "mine", label: "My templates" },
  { id: "uploads", label: "Uploads" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ViewMode = LibraryViewMode;
type ModalKind = "new-folder" | "rename" | "move" | "share" | "delete" | null;

function loadFavoriteSet(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistFavoriteSet(set: Set<string>) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
}

function loadViewMode(): ViewMode {
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

function FolderIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      className={className}
      aria-hidden
    >
      <path
        d="M3 7.5A1.5 1.5 0 014.5 6H9l2 2h8.5A1.5 1.5 0 0121 9.5v8A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
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

export default function AppTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("suggested");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [path, setPath] = useState<Breadcrumb[]>([{ id: null, name: "Library" }]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionHint, setActionHint] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [shareSeed, setShareSeed] = useState<string[]>([]);
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);
  const [browsingSamples, setBrowsingSamples] = useState(false);

  const currentFolderId = path[path.length - 1]?.id ?? null;
  const browseFolders = tab !== "suggested" && !browsingSamples;

  useEffect(() => {
    setFavorites(loadFavoriteSet());
    setViewMode(loadViewMode());
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("tab");
    if (next === "suggested" || next === "mine" || next === "uploads") {
      setTab(next);
    }
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    setSelected(new Set());
    setBrowsingSamples(false);
    if (id === "suggested") {
      setPath([{ id: null, name: "Library" }]);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  function openSampleTemplates() {
    setBrowsingSamples(true);
    setSelected(new Set());
    setSelectionMode(false);
    setActionHint("");
  }

  function exitSampleTemplates() {
    setBrowsingSamples(false);
    setSelected(new Set());
    setSelectionMode(false);
    setActionHint("");
  }

  function setView(next: ViewMode) {
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
    setMembers(
      payload.members.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
      })),
    );
  }, []);

  const loadLibrary = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (browseFolders) {
      params.set("folderId", currentFolderId ?? "root");
    }

    const folderParams = new URLSearchParams();
    if (browseFolders) {
      folderParams.set("parentId", currentFolderId ?? "root");
    }

    const [templatesRes, foldersRes, allFoldersRes] = await Promise.all([
      fetch(`/api/templates?${params.toString()}`),
      browseFolders
        ? fetch(`/api/templates/folders?${folderParams.toString()}`)
        : Promise.resolve(null),
      fetch("/api/templates/folders?all=1"),
    ]);

    if (!templatesRes.ok) {
      setError("Failed to load templates");
      setLoading(false);
      return;
    }

    const templatesPayload = (await templatesRes.json()) as { templates: TemplateItem[] };
    setTemplates(templatesPayload.templates);

    if (foldersRes?.ok) {
      const foldersPayload = (await foldersRes.json()) as { folders: FolderItem[] };
      setFolders(foldersPayload.folders);
    } else if (!browseFolders) {
      setFolders([]);
    }

    if (allFoldersRes.ok) {
      const allPayload = (await allFoldersRes.json()) as { folders: FolderItem[] };
      setAllFolders(allPayload.folders);
    }

    setLoading(false);
  }, [browseFolders, currentFolderId, query]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filtered = useMemo(() => {
    if (tab === "uploads") {
      return templates.filter((t) => t.tags.some((tag) => tag.toLowerCase() === "uploaded"));
    }
    if (tab === "suggested") {
      return templates.slice(0, SUGGESTED_LIMIT);
    }
    return templates;
  }, [templates, tab]);

  const selectedTemplates = useMemo(
    () => filtered.filter((t) => selected.has(t.id)),
    [filtered, selected],
  );

  function toggleFavorite(id: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistFavoriteSet(next);
      return next;
    });
  }

  function toggleSelected(id: string, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
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
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((t) => t.id)));
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
    setActionHint("Select templates with the checkboxes, then choose an action.");
  }

  function requireSelection(min = 1, max?: number): TemplateItem[] | null {
    setSelectionMode(true);
    if (selectedTemplates.length < min) {
      setActionHint(
        min === 1
          ? "Select at least one template with the checkboxes, then try again."
          : `Select ${min} templates, then try again.`,
      );
      setError("");
      return null;
    }
    if (max !== undefined && selectedTemplates.length > max) {
      setActionHint(max === 1 ? "Select a single template for this action." : `Select at most ${max} templates.`);
      setError("");
      return null;
    }
    setActionHint("");
    return selectedTemplates;
  }

  function openAction(kind: ModalKind) {
    if (kind === "new-folder") {
      setModal("new-folder");
      return;
    }
    if (kind === "rename") {
      const items = requireSelection(1, 1);
      if (!items?.[0]) {
        return;
      }
      setRenameTarget({ id: items[0].id, name: items[0].name });
      setModal("rename");
      return;
    }
    if (kind === "share") {
      const items = requireSelection(1, 1);
      if (!items?.[0]) {
        return;
      }
      setShareSeed(items[0].shared_with.map((s) => s.user_id));
      setShareFolderId(null);
      setModal("share");
      return;
    }
    const items = requireSelection(1);
    if (!items) {
      return;
    }
    setModal(kind);
  }

  async function createFolder(name: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/templates/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentFolderId }),
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

  async function renameTemplate(name: string) {
    if (!renameTarget) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/templates/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error("Could not rename template");
      }
      setModal(null);
      setRenameTarget(null);
      setSelected(new Set());
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename template");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateSelected() {
    const items = requireSelection(1);
    if (!items) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const template of items) {
        const response = await fetch(`/api/templates/${template.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duplicate: true }),
        });
        if (!response.ok) {
          throw new Error(`Could not duplicate “${template.name}”`);
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
    setBusy(true);
    setError("");
    try {
      for (const template of selectedTemplates) {
        const response = await fetch(`/api/templates/${template.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_id: folderId }),
        });
        if (!response.ok) {
          throw new Error(`Could not move “${template.name}”`);
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
        const response = await fetch("/api/templates/folders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: shareFolderId, shareUserIds: userIds }),
        });
        if (!response.ok) {
          throw new Error("Could not update folder sharing");
        }
      } else {
        const template = selectedTemplates[0];
        if (!template) {
          return;
        }
        const response = await fetch(`/api/templates/${template.id}`, {
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
    setBusy(true);
    setError("");
    try {
      for (const template of selectedTemplates) {
        const response = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error(`Could not delete “${template.name}”`);
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
          <h1 className="sr-only">Templates</h1>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-slate-100 text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted">
            {filtered.length} {filtered.length === 1 ? "template" : "templates"}
            {folders.length > 0 ? ` · ${folders.length} folders` : ""}
          </p>
          <div className="relative w-full min-w-0 sm:max-w-xs">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none ring-primary/15 focus:ring-2"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates…"
              aria-label="Search templates"
            />
          </div>
        </>
      }
    >
      {tab === "uploads" ? (
        <div className="border-b border-border px-4 py-3">
          <UploadDropzone folderId={currentFolderId} onUploaded={() => void loadLibrary()} />
        </div>
      ) : null}

      <LibraryViewActionsBar
        viewMode={viewMode}
        onViewModeChange={setView}
        showNewFolder={browseFolders && !browsingSamples}
        onNewFolder={() => openAction("new-folder")}
        selectionMode={selectionMode}
        selectionCount={selected.size}
        menuHint={selectionMode && selected.size === 0 ? "Select items below, then choose an action." : undefined}
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
          browsingSamples ? (
            <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
              <button
                type="button"
                onClick={exitSampleTemplates}
                className="text-muted hover:text-foreground"
              >
                Library
              </button>
              <span className="text-muted">/</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <FolderIcon filled className="text-primary" />
                Sample Templates
              </span>
            </nav>
          ) : browseFolders && path.length > 1 ? (
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
          ) : (
            <button
              type="button"
              onClick={openSampleTemplates}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-sm font-semibold text-foreground hover:bg-slate-50"
            >
              <FolderIcon filled className="text-primary" />
              Sample Templates
            </button>
          )
        }
      />

      {actionHint ? (
        <p className="border-b border-border bg-slate-50 px-4 py-2 text-sm text-muted">{actionHint}</p>
      ) : null}

      {browsingSamples ? (
        viewMode === "list" ? (
          <SheetTable
            minWidth="64rem"
            empty={
              <p className="px-4 py-10 text-center text-sm text-muted">
                Sample templates will appear here. Browse master Templates, Agreements, Contracts, and
                more — then add them to your Library.
              </p>
            }
          >
            <thead>
              <tr>
                <th className={sheetTh()}>Document Title</th>
                <th className={sheetTh()}>Category</th>
                <th className={sheetTh()}>Type</th>
                <th className={sheetTh()}>Description</th>
              </tr>
            </thead>
            <tbody />
          </SheetTable>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Sample templates will appear here. Browse master Templates, Agreements, Contracts, and more
            — then add them to your Library.
          </p>
        )
      ) : viewMode === "list" ? (
        <SheetTable
          minWidth="64rem"
          empty={
            !loading && filtered.length === 0 && folders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {tab === "uploads"
                  ? "No uploaded templates yet. Drop a PDF or DOCX above to create one."
                  : "No templates yet."}
              </p>
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
                    aria-label="Select all templates"
                    checked={filtered.length > 0 && selected.size === filtered.length}
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
            {browseFolders
              ? folders.map((folder) => (
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
                ))
              : null}
            {filtered.map((template) => {
              const checked = selected.has(template.id);
              return (
                <tr key={template.id} className={sheetTr(checked ? "bg-slate-50/90" : undefined)}>
                  {selectionMode ? (
                    <td className={sheetTd()}>
                      <input
                        type="checkbox"
                        data-library-select
                        aria-label={`Select ${template.name}`}
                        checked={checked}
                        onChange={() => toggleSelected(template.id)}
                      />
                    </td>
                  ) : null}
                  <td className={sheetTd("font-medium text-foreground")}>
                    <Link href={`/app/templates/${template.id}`} className="hover:text-primary">
                      {template.name}
                    </Link>
                  </td>
                  <td className={sheetTd()}>{formatDate(template.created_at)}</td>
                  <td className={sheetTd()}>{formatDate(template.updated_at)}</td>
                  <td className={sheetTd()}>{sharedLabel(template.shared_with)}</td>
                  <td className={sheetTd()}>{template.kind}</td>
                  <td className={sheetTd()}>{template.owner_name}</td>
                  <td className={sheetTd()}>{template.updated_by_name ?? template.owner_name}</td>
                </tr>
              );
            })}
          </tbody>
        </SheetTable>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-4 p-4">
          {browseFolders
            ? folders.map((folder) => (
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
              ))
            : null}

          {filtered.map((template) => {
            const pages = pageCountFromEditor(template.editor_json);
            const starred = favorites.has(template.id);
            const subtitle = templateSubtitleFromTags(template.tags);
            const thumbnailKey = templateThumbnailKey(template.editor_json);
            const checked = selected.has(template.id);
            return (
              <div
                key={template.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/app/templates/${template.id}`} className="flex flex-1 flex-col">
                  <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-slate-100">
                    {thumbnailKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={assetUrl(thumbnailKey)}
                        alt=""
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                      />
                    ) : (
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-slate-400"
                        aria-hidden
                      >
                        <path
                          d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-white/85 px-1.5 py-0.5 text-xs text-muted">
                      {pages} {pages === 1 ? "page" : "pages"}
                    </span>
                  </div>
                  <div className="border-t border-border p-3">
                    <p className="truncate font-semibold text-foreground">{template.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {subtitle} · {template.kind}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(template.id, e)}
                  className="absolute right-2 top-2 rounded p-1 text-amber-500 hover:bg-white/80"
                  aria-label={starred ? "Remove from favorites" : "Add to favorites"}
                >
                  {starred ? "★" : "☆"}
                </button>
                <label
                  data-library-select
                  className="absolute bottom-3 right-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-border bg-white/95 shadow-sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    data-library-select
                    className="h-3.5 w-3.5"
                    aria-label={`Select ${template.name}`}
                    checked={checked}
                    onChange={() => {
                      setSelectionMode(true);
                      toggleSelected(template.id);
                      setActionHint("");
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {!loading && viewMode === "preview" && filtered.length === 0 && folders.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          {tab === "uploads"
            ? "No uploaded templates yet. Drop a PDF or DOCX above to create one."
            : "No templates yet."}
        </p>
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
        title="Rename template"
        label="Document title"
        initialValue={renameTarget?.name ?? ""}
        confirmLabel="Rename"
        busy={busy}
        onClose={() => {
          setModal(null);
          setRenameTarget(null);
        }}
        onConfirm={renameTemplate}
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
        count={selectedTemplates.length}
        busy={busy}
        onClose={() => setModal(null)}
        onConfirm={deleteSelected}
      />
    </SheetPage>
  );
}
