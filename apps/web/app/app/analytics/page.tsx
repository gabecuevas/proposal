"use client";

import { useCallback, useEffect, useState } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

type OverviewMetrics = {
  docsSent: number;
  avgTimeToSignMs: number | null;
  viewToSignRate: number | null;
  paidRevenue: number;
  webhookDeadLetterRate: number;
  webhookDeadLetters: number;
  webhookTotal: number;
  pdfQueueFailures: number;
  paymentsCreated: number;
  paymentsCompleted: number;
  paymentsCompletedAmount: number;
};

type OverviewResponse = {
  range: {
    days: number;
    since: string;
  };
  metrics: OverviewMetrics;
};

type DocumentItem = {
  id: string;
  status: string;
};

type DocumentAnalytics = {
  analytics: {
    document: {
      id: string;
      status: string;
    };
    timeline: {
      sentAt: string | null;
      viewedAt: string | null;
      finalizedAt: string | null;
      pdfStoredAt: string | null;
    };
    durationsMs: {
      sentToFinalizedMs: number | null;
      viewedToFinalizedMs: number | null;
    };
    webhookDeliveries: Array<{ status: string; count: number }>;
  };
};

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "—";
  }
  const minutes = ms / 1000 / 60;
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = minutes / 60;
  return `${hours.toFixed(1)} h`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

export default function AnalyticsPage() {
  const [days, setDays] = useState("30");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedAnalytics, setSelectedAnalytics] = useState<DocumentAnalytics | null>(null);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setError("");
    const response = await fetch(`/api/analytics/overview?days=${encodeURIComponent(days)}`);
    if (!response.ok) {
      setError("Failed to load workspace analytics.");
      return;
    }
    const payload = (await response.json()) as OverviewResponse;
    setOverview(payload);
  }, [days]);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/documents?limit=100");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { documents: Array<{ id: string; status: string }> };
    const items = payload.documents.map((doc) => ({ id: doc.id, status: doc.status }));
    setDocuments(items);
    setSelectedDocumentId((current) => current || items[0]?.id || "");
  }, []);

  const loadDocumentAnalytics = useCallback(async (documentId: string) => {
    if (!documentId) {
      setSelectedAnalytics(null);
      return;
    }
    const response = await fetch(`/api/analytics/documents/${documentId}`);
    if (!response.ok) {
      setSelectedAnalytics(null);
      return;
    }
    const payload = (await response.json()) as DocumentAnalytics;
    setSelectedAnalytics(payload);
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void loadDocumentAnalytics(selectedDocumentId);
  }, [loadDocumentAnalytics, selectedDocumentId]);

  const metrics: Array<{ label: string; value: string | number }> = [
    { label: "Docs Sent", value: overview?.metrics.docsSent ?? 0 },
    { label: "Avg Time To Sign", value: formatDuration(overview?.metrics.avgTimeToSignMs ?? null) },
    {
      label: "View To Sign",
      value:
        overview?.metrics.viewToSignRate === null
          ? "—"
          : `${((overview?.metrics.viewToSignRate ?? 0) * 100).toFixed(1)}%`,
    },
    { label: "Paid Revenue", value: `$${(overview?.metrics.paidRevenue ?? 0).toFixed(2)}` },
    {
      label: "Webhook Dead-Letter Rate",
      value: `${((overview?.metrics.webhookDeadLetterRate ?? 0) * 100).toFixed(2)}%`,
    },
    { label: "Dead Letters", value: overview?.metrics.webhookDeadLetters ?? 0 },
    { label: "Webhook Deliveries", value: overview?.metrics.webhookTotal ?? 0 },
    { label: "PDF Queue Failures", value: overview?.metrics.pdfQueueFailures ?? 0 },
    { label: "Payments Created", value: overview?.metrics.paymentsCreated ?? 0 },
    { label: "Payments Completed", value: overview?.metrics.paymentsCompleted ?? 0 },
    {
      label: "Payments Completed Amount",
      value: `$${(overview?.metrics.paymentsCompletedAmount ?? 0).toFixed(2)}`,
    },
  ];

  return (
    <SheetPage
      error={error}
      toolbar={
        <>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-foreground">Analytics</h1>
            <p className="text-xs text-muted">Signing velocity, conversions, and delivery reliability.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Range (days)</span>
            <input
              className="h-10 w-24 rounded-md border border-border bg-surface px-2 text-sm outline-none ring-primary/15 focus:ring-2"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </label>
        </>
      }
    >
      <SheetTable>
        <thead>
          <tr>
            <th className={sheetTh()}>Metric</th>
            <th className={sheetTh()}>Value</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.label} className={sheetTr()}>
              <td className={sheetTd()}>{metric.label}</td>
              <td className={sheetTd("font-medium text-foreground")}>{metric.value}</td>
            </tr>
          ))}
        </tbody>
      </SheetTable>

      <header className="flex flex-wrap items-center gap-3 border-b border-t border-border bg-slate-50 px-3 py-2">
        <h2 className="text-[13px] font-semibold text-foreground">Per-document analytics</h2>
        <select
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm outline-none ring-primary/15 focus:ring-2"
          value={selectedDocumentId}
          onChange={(event) => setSelectedDocumentId(event.target.value)}
        >
          <option value="">Select a document</option>
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.id} ({document.status})
            </option>
          ))}
        </select>
      </header>

      {selectedAnalytics ? (
        <>
          <SheetTable>
            <thead>
              <tr>
                <th className={sheetTh()}>Event</th>
                <th className={sheetTh()}>When</th>
              </tr>
            </thead>
            <tbody>
              <tr className={sheetTr()}>
                <td className={sheetTd()}>Sent</td>
                <td className={sheetTd()}>{formatDate(selectedAnalytics.analytics.timeline.sentAt)}</td>
              </tr>
              <tr className={sheetTr()}>
                <td className={sheetTd()}>Viewed</td>
                <td className={sheetTd()}>{formatDate(selectedAnalytics.analytics.timeline.viewedAt)}</td>
              </tr>
              <tr className={sheetTr()}>
                <td className={sheetTd()}>Finalized</td>
                <td className={sheetTd()}>{formatDate(selectedAnalytics.analytics.timeline.finalizedAt)}</td>
              </tr>
              <tr className={sheetTr()}>
                <td className={sheetTd()}>PDF stored</td>
                <td className={sheetTd()}>{formatDate(selectedAnalytics.analytics.timeline.pdfStoredAt)}</td>
              </tr>
              <tr className={sheetTr()}>
                <td className={sheetTd()}>Sent → Finalized</td>
                <td className={sheetTd()}>
                  {formatDuration(selectedAnalytics.analytics.durationsMs.sentToFinalizedMs)}
                </td>
              </tr>
              <tr className={sheetTr()}>
                <td className={sheetTd()}>Viewed → Finalized</td>
                <td className={sheetTd()}>
                  {formatDuration(selectedAnalytics.analytics.durationsMs.viewedToFinalizedMs)}
                </td>
              </tr>
            </tbody>
          </SheetTable>
          <SheetTable
            empty={
              selectedAnalytics.analytics.webhookDeliveries.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  No webhook deliveries for this document.
                </p>
              ) : null
            }
          >
            {selectedAnalytics.analytics.webhookDeliveries.length > 0 ? (
              <>
                <thead>
                  <tr>
                    <th className={sheetTh()}>Webhook status</th>
                    <th className={sheetTh()}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAnalytics.analytics.webhookDeliveries.map((row) => (
                    <tr key={row.status} className={sheetTr()}>
                      <td className={sheetTd()}>{row.status}</td>
                      <td className={sheetTd("font-medium text-foreground")}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : null}
          </SheetTable>
        </>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted">
          Select a document to inspect lifecycle metrics.
        </p>
      )}
    </SheetPage>
  );
}
