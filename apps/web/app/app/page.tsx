"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChartPanel } from "@/components/dashboard/bar-chart";
import { WorkspaceTools } from "@/components/dashboard/workspace-tools";
import { SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import { buildSampleOverview } from "@/lib/dashboard/sample-data";
import type { DashboardActivityKind, DashboardOverview } from "@/lib/dashboard/types";

const SAMPLE_DISMISSED_KEY = "doxysign.dashboard.sampleDismissed";

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

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCross({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 3L2 10.5l7 2.5 2.5 7L21 3z" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconActivity({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 18a14 14 0 0114 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" transform="translate(0 -10)" />
      <path d="M4 13a9 9 0 019 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 7a15 15 0 0115 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="5" cy="19" r="1.6" fill="currentColor" />
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
  View: "bg-sky-100 text-sky-700",
  Sent: "bg-indigo-100 text-indigo-700",
  Signed: "bg-emerald-100 text-emerald-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Comment: "bg-amber-100 text-amber-800",
  Approval: "bg-violet-100 text-violet-700",
  Event: "bg-slate-100 text-slate-600",
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

function activityIcon(kind: DashboardActivityKind) {
  switch (kind) {
    case "View":
      return <IconEye className="h-3 w-3" />;
    case "Sent":
      return <IconSend className="h-3 w-3" />;
    case "Signed":
    case "Paid":
    case "Approval":
      return <IconCheck />;
    case "Comment":
      return <IconComment />;
    default:
      return <IconDot />;
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
      icon: <IconBolt />,
      tone: "text-amber-600",
    },
    {
      key: "accepted",
      count: totals.accepted.count,
      label: "Accepted",
      value: totals.accepted.value,
      icon: <IconCheck />,
      tone: "text-emerald-600",
    },
    {
      key: "declined",
      count: totals.declined.count,
      label: "Declined",
      value: totals.declined.value,
      icon: <IconCross />,
      tone: "text-red-600",
    },
  ];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto bg-surface">
      {showSample ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
          <span className="rounded bg-amber-200/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            Sample Data
          </span>
          <p className="min-w-0 flex-1 text-amber-900/90">
            These figures are illustrative. Close this banner to see your workspace&apos;s real
            numbers.
          </p>
          <button
            type="button"
            onClick={dismissSample}
            className="shrink-0 rounded p-1 text-amber-800 transition-colors hover:bg-amber-100"
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

      <div className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="border-b border-border px-3 py-4 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <p className="text-3xl font-semibold tabular-nums text-foreground">{stat.count}</p>
            <p className={`mt-1 flex items-center justify-center gap-1.5 text-xs ${stat.tone}`}>
              {stat.icon}
              {stat.label}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(stat.value, currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid border-b border-border lg:grid-cols-2">
        <BarChartPanel title="Deliveries" icon={<IconSend />} points={data.series.deliveries} />
        <BarChartPanel title="Views" icon={<IconEye />} points={data.series.views} />
      </div>

      <section>
        <header className="flex items-center gap-2 border-b border-border bg-slate-50 px-3 py-2 text-[13px] font-semibold text-foreground">
          <span className="text-muted" aria-hidden>
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
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${activityBadgeClass[item.kind]}`}
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

      <WorkspaceTools />
    </div>
  );
}
