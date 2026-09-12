"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChartPanel } from "@/components/dashboard/bar-chart";
import {
  IconCompleted,
  IconDeclined,
  IconEmailSent,
  IconInProgress,
  IconViewed,
} from "@/components/app-shell/shell-icons";
import { SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import { buildSampleOverview } from "@/lib/dashboard/sample-data";
import type { DashboardActivityKind, DashboardOverview } from "@/lib/dashboard/types";

const SAMPLE_DISMISSED_KEY = "senddox.dashboard.sampleDismissed";

const emptyOverview: DashboardOverview = {
  currency: "USD",
  totals: {
    inProgress: { count: 0, value: 0 },
    accepted: { count: 0, value: 0 },
    declined: { count: 0, value: 0 },
  },
  series: { deliveries: [], views: [] },
  activity: [],
  teamMemberCount: 0,
};

function IconComment({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 5h16v11H10l-4 3v-3H4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconDot({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function IconActivity({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12h4l2.5-5 3 10L16 9.5 18 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const activityBadgeClass: Record<DashboardActivityKind, string> = {
  View: "bg-primary/10 text-primary",
  Sent: "bg-slate-100 text-slate-700",
  Signed: "bg-emerald-50 text-emerald-800",
  Paid: "bg-emerald-50 text-emerald-800",
  Comment: "bg-amber-50 text-amber-900",
  Approval: "bg-slate-100 text-slate-700",
  Event: "bg-slate-100 text-slate-600",
};

function activityIcon(kind: DashboardActivityKind) {
  switch (kind) {
    case "View":
      return <IconViewed className="h-3.5 w-3.5" />;
    case "Sent":
      return <IconEmailSent className="h-3.5 w-3.5" />;
    case "Signed":
    case "Paid":
    case "Approval":
      return <IconCompleted className="h-3.5 w-3.5" />;
    case "Comment":
      return <IconComment className="h-3.5 w-3.5" />;
    default:
      return <IconDot className="h-3.5 w-3.5" />;
  }
}

export default function AppHomePage() {
  const [realOverview, setRealOverview] = useState<DashboardOverview | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sampleOverview = useMemo(() => (mounted ? buildSampleOverview() : null), [mounted]);

  useEffect(() => {
    setMounted(true);
    setShowSample(window.localStorage.getItem(SAMPLE_DISMISSED_KEY) !== "1");

    let cancelled = false;
    async function load() {
      const response = await fetch("/api/dashboard/overview");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { overview: DashboardOverview };
      if (!cancelled) {
        setRealOverview(payload.overview);
      }
    }
    void load().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  function dismissSample() {
    setShowSample(false);
    window.localStorage.setItem(SAMPLE_DISMISSED_KEY, "1");
  }

  function restoreSample() {
    setShowSample(true);
    window.localStorage.removeItem(SAMPLE_DISMISSED_KEY);
  }

  const data = (showSample ? sampleOverview : realOverview) ?? emptyOverview;
  const { totals, currency } = data;

  const stats = [
    {
      key: "inProgress",
      count: totals.inProgress.count,
      label: "In Progress",
      value: totals.inProgress.value,
      icon: <IconInProgress className="h-3.5 w-3.5" />,
      tone: "text-amber-700",
      chip: "bg-amber-50 border-amber-200",
    },
    {
      key: "accepted",
      count: totals.accepted.count,
      label: "Accepted",
      value: totals.accepted.value,
      icon: <IconCompleted className="h-3.5 w-3.5" />,
      tone: "text-emerald-700",
      chip: "bg-emerald-50 border-emerald-200",
    },
    {
      key: "declined",
      count: totals.declined.count,
      label: "Declined",
      value: totals.declined.value,
      icon: <IconDeclined className="h-3.5 w-3.5" />,
      tone: "text-red-700",
      chip: "bg-red-50 border-red-200",
    },
  ];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto bg-surface">
      {showSample ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-slate-50 px-4 py-2.5 text-sm">
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Sample Data
          </span>
          <p className="min-w-0 flex-1 text-muted">
            These figures are illustrative. Close this banner to see your workspace&apos;s real numbers.
          </p>
          <button
            type="button"
            onClick={dismissSample}
            className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
            aria-label="Dismiss sample data"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 justify-end border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={restoreSample}
            className="text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Show sample data
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 border-b border-border bg-[#f4f6f9] p-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="rounded-lg border border-border bg-surface px-4 py-5 text-center shadow-[0_1px_2px_rgba(30,58,95,0.04)]"
          >
            <p
              className="text-4xl tabular-nums tracking-tight text-foreground"
              style={{
                fontFamily: 'Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace',
                fontWeight: 700,
              }}
            >
              {stat.count}
            </p>
            <p
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${stat.chip} ${stat.tone}`}
            >
              {stat.icon}
              {stat.label}
            </p>
            <p className="mt-2.5 text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(stat.value, currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid border-b border-border lg:grid-cols-2">
        <BarChartPanel title="Deliveries" icon={<IconEmailSent className="h-4 w-4" />} points={data.series.deliveries} />
        <BarChartPanel title="Views" icon={<IconViewed className="h-4 w-4" />} points={data.series.views} />
      </div>

      <section>
        <header className="flex items-center gap-2 border-b border-border bg-slate-50 px-3 py-2 text-[13px] font-semibold text-foreground">
          <span className="text-primary" aria-hidden>
            <IconActivity />
          </span>
          Activity
        </header>

        <SheetTable
          empty={
            data.activity.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No activity yet.</p>
            ) : null
          }
        >
          {data.activity.length > 0 ? (
            <thead>
              <tr>
                <th className={sheetTh()}>Type</th>
                <th className={sheetTh()}>When</th>
                <th className={sheetTh()}>Actor</th>
                <th className={sheetTh()}>Document</th>
              </tr>
            </thead>
          ) : null}
          <tbody>
            {data.activity.map((item) => (
              <tr key={item.id} className={sheetTr()}>
                <td className={sheetTd("whitespace-nowrap")}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${activityBadgeClass[item.kind]}`}
                  >
                    {activityIcon(item.kind)}
                    {item.kind}
                  </span>
                </td>
                <td className={sheetTd("whitespace-nowrap")}>{formatTimestamp(item.occurredAt)}</td>
                <td className={sheetTd("font-medium text-foreground")}>{item.actor}</td>
                <td className={sheetTd()}>
                  {item.documentId ? (
                    <Link href={`/app/documents/${item.documentId}`} className="text-primary hover:underline">
                      {item.documentTitle}
                    </Link>
                  ) : (
                    <span>{item.documentTitle}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </SheetTable>
      </section>
    </div>
  );
}
