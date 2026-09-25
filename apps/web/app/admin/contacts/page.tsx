"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import {
  ActionsMenu,
  ConfirmActionDialog,
  EditContactDialog,
  type ActionContact,
  type MenuAction,
} from "./contact-actions";
import { ContactShelf, type ContactDetail } from "./contact-shelf";
import { dateOnly, statusBadgeClass, timeAgo } from "./format";
import { ColumnsMenu, FilterMenu, type FilterGroup } from "./toolbar-menus";

type ContactRow = ActionContact & {
  userId: string;
  accountId: string | null;
  company: string;
  userType: string;
  city: string;
  timezone: string;
  sessionCount: number;
  accountUserCount: number | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  trackedSince: string | null;
  createdAt: string;
  workspaceCount: number;
  status: "Active" | "Disabled" | "Archived";
  disabledReason: string | null;
};

type BulkResult = { userId: string; email: string | null; ok: boolean; message?: string };

type Filters = { status: string[]; type: string[]; flags: string[] };

const DEFAULT_FILTERS: Filters = { status: ["active", "disabled"], type: [], flags: [] };

const HIDDEN_COLUMNS_KEY = "admin-contacts-hidden-columns:v2";
const DEFAULT_HIDDEN_COLUMNS = ["accountId", "userId"];

function muted(text: string, known: boolean): ReactNode {
  return known ? text : <span className="text-slate-400">{text}</span>;
}

function OpenShelfLink({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="text-left hover:text-primary hover:underline"
    >
      {children}
    </button>
  );
}

type Column = {
  key: string;
  label: string;
  locked?: boolean;
  align?: "right";
  render: (row: ContactRow, open: () => void) => ReactNode;
};

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Name",
    locked: true,
    render: (row, open) => (
      <OpenShelfLink onOpen={open}>
        <span className="font-medium text-foreground">{row.name}</span>
      </OpenShelfLink>
    ),
  },
  {
    key: "email",
    label: "Email",
    render: (row) => (
      <>
        {row.email}
        {!row.emailVerified ? <span className="ml-1 text-xs text-slate-400">(unverified)</span> : null}
      </>
    ),
  },
  {
    key: "company",
    label: "Company",
    render: (row, open) =>
      row.company === "Unknown" ? (
        muted(row.company, false)
      ) : (
        <OpenShelfLink onOpen={open}>{row.company}</OpenShelfLink>
      ),
  },
  {
    key: "accountId",
    label: "Account ID",
    render: (row) =>
      row.accountId ? <span className="font-mono text-xs">{row.accountId}</span> : muted("None", false),
  },
  { key: "userId", label: "User ID", render: (row) => <span className="font-mono text-xs">{row.userId}</span> },
  {
    key: "type",
    label: "Type",
    render: (row) => (
      <span className="rounded-none border border-border px-1.5 py-0.5 text-xs">{row.userType}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (row) => (
      <>
        <span
          title={row.disabledReason ?? undefined}
          className={`rounded-none border px-1.5 py-0.5 text-xs ${statusBadgeClass(row.status)}`}
        >
          {row.status}
        </span>
        {row.billingFrozen ? (
          <span className="ml-1 rounded-none border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">
            Billing frozen
          </span>
        ) : null}
      </>
    ),
  },
  { key: "signup", label: "Signup", render: (row) => new Date(row.createdAt).toLocaleDateString() },
  { key: "sessions", label: "Sessions", align: "right", render: (row) => row.sessionCount },
  {
    key: "lastLogin",
    label: "Last login",
    render: (row) => (
      <span title={row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : undefined}>
        {muted(timeAgo(row.lastLoginAt), Boolean(row.lastLoginAt))}
      </span>
    ),
  },
  {
    key: "lastActive",
    label: "Last active",
    render: (row) => muted(dateOnly(row.lastActiveAt), Boolean(row.lastActiveAt)),
  },
  { key: "city", label: "City", render: (row) => muted(row.city, row.city !== "Unknown") },
  { key: "timezone", label: "Timezone", render: (row) => muted(row.timezone, row.timezone !== "Unknown") },
];

function filtersToParams(filters: Filters, params: URLSearchParams) {
  params.set("status", filters.status.join(","));
  if (filters.type.length) params.set("type", filters.type.join(","));
  if (filters.flags.length) params.set("flags", filters.flags.join(","));
}

export default function AdminContactsPage() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLoadedId, setDetailLoadedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set(DEFAULT_HIDDEN_COLUMNS));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<MenuAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string; details?: string[] } | null>(null);
  const pageSize = 25;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_COLUMNS_KEY);
      const stored = raw === null ? null : (JSON.parse(raw) as unknown);
      if (Array.isArray(stored)) {
        setHiddenColumns(new Set(stored.filter((k): k is string => typeof k === "string")));
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  function updateHiddenColumns(next: Set<string>) {
    setHiddenColumns(next);
    try {
      window.localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...next]));
    } catch {
      // ignore quota / private mode
    }
  }

  const visibleColumns = COLUMNS.filter((c) => c.locked || !hiddenColumns.has(c.key));

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedQ.trim()) params.set("q", appliedQ.trim());
    filtersToParams(filters, params);
    return params;
  }, [appliedQ, filters]);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams(queryParams);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", "last_active_at");
    params.set("sortDir", "desc");
    const res = await fetch(`/api/admin/contacts?${params.toString()}`);
    setLoaded(true);
    if (!res.ok) {
      setError("Unable to load contacts");
      return;
    }
    const data = (await res.json()) as { contacts: ContactRow[]; total: number };
    setRows(data.contacts);
    setTotal(data.total);
    setChecked((prev) => new Set(data.contacts.filter((c) => prev.has(c.id)).map((c) => c.id)));
  }, [page, queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/admin/contacts/${id}`).catch(() => null);
    const data = (res?.ok ? await res.json() : null) as { contact?: ContactDetail } | null;
    setDetail((current) => (data?.contact ?? (current?.id === id ? current : null)));
    setDetailLoadedId(id);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const selected = useMemo(() => rows.filter((r) => checked.has(r.id)), [rows, checked]);
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const filterGroups: FilterGroup[] = [
    {
      id: "status",
      label: "Status",
      hint: "None checked shows every status.",
      options: [
        { value: "active", label: "Active" },
        { value: "disabled", label: "Disabled" },
        { value: "archived", label: "Archived" },
      ],
      selected: filters.status,
    },
    {
      id: "type",
      label: "Type",
      options: [
        { value: "owner", label: "Account Owner" },
        { value: "user", label: "User" },
      ],
      selected: filters.type,
    },
    {
      id: "flags",
      label: "Only show",
      options: [
        { value: "frozen", label: "Billing frozen" },
        { value: "unverified", label: "Unverified email" },
      ],
      selected: filters.flags,
    },
  ];

  const filtersAreDefault =
    filters.status.join(",") === DEFAULT_FILTERS.status.join(",") &&
    filters.type.length === 0 &&
    filters.flags.length === 0;
  const activeFilterCount = filtersAreDefault
    ? 0
    : filters.status.length + filters.type.length + filters.flags.length;

  function toggleFilter(groupId: string, value: string) {
    const key = groupId as keyof Filters;
    setFilters((prev) => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
    setPage(1);
    setChecked(new Set());
  }

  function toggleRow(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applySearch() {
    setPage(1);
    setAppliedQ(q);
  }

  async function runConfirmedAction(
    action: Exclude<MenuAction, "edit">,
    options: { reason: string; purgeWorkspaces: boolean; confirm: string },
  ) {
    setBusy(true);
    setNotice(null);
    if (action === "sudo") {
      const target = selected[0]!;
      const res = await fetch(`/api/admin/contacts/${target.id}/sudo`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { redirectHint?: string; error?: { message?: string } }
        | null;
      if (!res.ok) {
        setBusy(false);
        setPendingAction(null);
        setNotice({ tone: "warn", text: data?.error?.message ?? "Unable to start sudo" });
        return;
      }
      window.location.assign(data?.redirectHint ?? "/app");
      return;
    }

    const res = await fetch("/api/admin/contacts/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        userIds: selected.map((c) => c.id),
        reason: options.reason,
        purgeWorkspaces: options.purgeWorkspaces,
        confirm: options.confirm,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { results?: BulkResult[]; succeeded?: number; failed?: number; error?: { message?: string } }
      | null;
    setBusy(false);
    setPendingAction(null);
    if (!res.ok || !data?.results) {
      setNotice({ tone: "warn", text: data?.error?.message ?? "Action failed" });
      return;
    }
    const failures = data.results.filter((r) => !r.ok);
    setNotice({
      tone: failures.length ? "warn" : "ok",
      text: `${data.succeeded ?? 0} updated${failures.length ? `, ${failures.length} skipped` : ""}.`,
      details: data.results.filter((r) => r.message).map((r) => `${r.email ?? r.userId}: ${r.message}`),
    });
    setChecked(new Set());
    if (action === "delete" && selectedId && selected.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    } else if (selectedId) {
      void loadDetail(selectedId);
    }
    await load();
  }

  const exportParams = new URLSearchParams(queryParams);
  exportParams.set("format", "csv");

  return (
    <SheetPage
      error={error}
      toolbar={
        <>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applySearch();
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, or company"
              className="w-64 rounded-none border border-border px-2 py-1.5 text-sm"
            />
            <button type="submit" className="rounded-none bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              Search
            </button>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/api/admin/contacts?${exportParams.toString()}`}
              title="Exports every contact matching the current search and filters"
              className="rounded-none border border-border px-3 py-1.5 text-sm"
            >
              Export CSV
            </a>
            <FilterMenu
              groups={filterGroups}
              activeCount={activeFilterCount}
              onToggle={toggleFilter}
              onReset={() => {
                setFilters(DEFAULT_FILTERS);
                setPage(1);
                setChecked(new Set());
              }}
            />
            <ActionsMenu selected={selected} onAction={setPendingAction} />
            <ColumnsMenu
              columns={COLUMNS}
              hidden={hiddenColumns}
              onToggle={(key) => {
                const next = new Set(hiddenColumns);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                updateHiddenColumns(next);
              }}
              onShowAll={() => updateHiddenColumns(new Set())}
            />
          </div>
        </>
      }
    >
      {notice ? (
        <div
          className={`flex items-start gap-3 border-b px-4 py-2 text-sm ${
            notice.tone === "ok" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div>
            <p>{notice.text}</p>
            {notice.details?.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                {notice.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button type="button" className="ml-auto text-xs text-muted" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {pendingAction === "edit" && selected.length === 1 ? (
        <EditContactDialog
          contact={selected[0]!}
          onClose={() => setPendingAction(null)}
          onSaved={(message) => {
            setPendingAction(null);
            setNotice({ tone: "ok", text: message });
            void load();
            if (selectedId) void loadDetail(selectedId);
          }}
        />
      ) : null}
      {pendingAction && pendingAction !== "edit" && selected.length > 0 ? (
        <ConfirmActionDialog
          action={pendingAction}
          selected={selected}
          busy={busy}
          onCancel={() => setPendingAction(null)}
          onConfirm={(options) => void runConfirmedAction(pendingAction, options)}
        />
      ) : null}
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto">
            <SheetTable
              preventWrap
              empty={
                loaded && rows.length === 0 ? (
                  <p className="p-4 text-sm text-muted">No contacts match the current search and filters.</p>
                ) : undefined
              }
            >
              <thead className="sticky top-0 z-10">
                <tr className={sheetTr()}>
                  <th className={sheetTh("w-10 text-center")}>
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allChecked}
                      onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </th>
                  {visibleColumns.map((column) => (
                    <th key={column.key} className={sheetTh(column.align === "right" ? "text-right" : undefined)}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`${sheetTr()} cursor-pointer ${selectedId === row.id ? "bg-slate-50" : ""}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className={sheetTd("w-10 text-center")} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.email}`}
                        checked={checked.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        className={sheetTd(column.align === "right" ? "text-right tabular-nums" : undefined)}
                      >
                        {column.render(row, () => setSelectedId(row.id))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </SheetTable>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-none border border-border px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {page} / {pages} ({total} total)
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-none border border-border px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
        {selectedId ? (
          <ContactShelf
            detail={detail}
            loading={detailLoading || detailLoadedId !== selectedId}
            onClose={() => setSelectedId(null)}
            onSelectUser={setSelectedId}
          />
        ) : null}
      </div>
    </SheetPage>
  );
}
