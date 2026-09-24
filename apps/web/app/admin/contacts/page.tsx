"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

type ContactRow = {
  id: string;
  email: string;
  name: string;
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
};

function fmt(value: string | null) {
  if (!value) {
    return "Not tracked";
  }
  return new Date(value).toLocaleString();
}

export default function AdminContactsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort: "last_active_at",
      sortDir: "desc",
    });
    if (q.trim()) {
      params.set("q", q.trim());
    }
    const res = await fetch(`/api/admin/contacts?${params.toString()}`);
    if (!res.ok) {
      setError("Unable to load contacts");
      return;
    }
    const data = (await res.json()) as {
      contacts: ContactRow[];
      total: number;
    };
    setRows(data.contacts);
    setTotal(data.total);
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void fetch(`/api/admin/contacts/${selectedId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { contact?: Record<string, unknown> } | null) => {
        setDetail(data?.contact ?? null);
      });
  }, [selectedId]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SheetPage
      error={error}
      toolbar={
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, or company"
            className="min-w-[220px] rounded-none border border-border px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="rounded-none bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Search
          </button>
          <a
            href={`/api/admin/contacts?format=csv&q=${encodeURIComponent(q)}`}
            className="rounded-none border border-border px-3 py-1.5 text-sm"
          >
            Export CSV
          </a>
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          <SheetTable empty={rows.length === 0 ? <p className="p-4 text-sm text-muted">No contacts</p> : undefined}>
            <thead>
              <tr className={sheetTr()}>
                <th className={sheetTh()}>Name</th>
                <th className={sheetTh()}>Email</th>
                <th className={sheetTh()}>Company</th>
                <th className={sheetTh()}>Type</th>
                <th className={sheetTh()}>Signup</th>
                <th className={sheetTh()}>Sessions</th>
                <th className={sheetTh()}>Last login</th>
                <th className={sheetTh()}>Last active</th>
                <th className={sheetTh()}>City / TZ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`${sheetTr()} cursor-pointer ${selectedId === row.id ? "bg-slate-50" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className={sheetTd()}>{row.name}</td>
                  <td className={sheetTd()}>
                    {row.email}
                    {!row.emailVerified ? (
                      <span className="ml-1 text-xs text-muted">(unverified)</span>
                    ) : null}
                  </td>
                  <td className={sheetTd()}>{row.company}</td>
                  <td className={sheetTd()}>
                    <span className="rounded-none border border-border px-1.5 py-0.5 text-xs">
                      {row.userType}
                    </span>
                  </td>
                  <td className={sheetTd()}>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className={sheetTd()}>
                    {row.sessionCount}
                    {row.trackedSince ? (
                      <div className="text-xs text-muted">
                        Tracked since {new Date(row.trackedSince).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className={sheetTd()}>{fmt(row.lastLoginAt)}</td>
                  <td className={sheetTd()}>{fmt(row.lastActiveAt)}</td>
                  <td className={sheetTd()}>
                    {row.city} / {row.timezone}
                  </td>
                </tr>
              ))}
            </tbody>
          </SheetTable>
          <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-sm">
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
        {detail ? (
          <aside className="w-80 shrink-0 overflow-auto border-l border-border p-4 text-sm">
            <h2 className="font-semibold">{String(detail.name)}</h2>
            <p className="text-muted">{String(detail.email)}</p>
            <p className="mt-2">
              Sessions: {String(detail.sessionCount ?? 0)}
              {detail.trackedSince
                ? ` · Tracked since ${new Date(String(detail.trackedSince)).toLocaleDateString()}`
                : ""}
            </p>
            <h3 className="mt-4 font-medium">Memberships</h3>
            <ul className="mt-1 space-y-1">
              {((detail.memberships as Array<Record<string, unknown>>) ?? []).map((m) => (
                <li key={String(m.workspaceId)}>
                  {String(m.workspaceName)} · {String(m.userType)} · {String(m.accountUserCount)} users
                </li>
              ))}
            </ul>
            <h3 className="mt-4 font-medium">Conversations</h3>
            <ul className="mt-1 space-y-1">
              {((detail.conversations as Array<Record<string, unknown>>) ?? []).map((c) => (
                <li key={String(c.id)}>
                  <Link href={`/admin/inbox?c=${String(c.id)}`} className="text-primary hover:underline">
                    {String(c.subject)} ({String(c.status)})
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 rounded-none border border-border px-2 py-1"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </aside>
        ) : null}
      </div>
    </SheetPage>
  );
}
