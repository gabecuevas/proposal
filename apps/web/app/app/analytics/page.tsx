"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";

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

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted">Track signing velocity, conversions, and delivery reliability.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Range (days)</span>
          <input
            className="w-24 rounded border border-border bg-background px-2 py-1"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Docs Sent" value={overview?.metrics.docsSent ?? 0} />
        <MetricCard label="Avg Time To Sign" value={formatDuration(overview?.metrics.avgTimeToSignMs ?? null)} />
        <MetricCard
          label="View To Sign"
          value={
            overview?.metrics.viewToSignRate === null
              ? "—"
              : `${((overview?.metrics.viewToSignRate ?? 0) * 100).toFixed(1)}%`
          }
        />
        <MetricCard label="Paid Revenue" value={`$${(overview?.metrics.paidRevenue ?? 0).toFixed(2)}`} />
        <MetricCard
          label="Webhook Dead-Letter Rate"
          value={`${((overview?.metrics.webhookDeadLetterRate ?? 0) * 100).toFixed(2)}%`}
        />
        <MetricCard label="Dead Letters" value={overview?.metrics.webhookDeadLetters ?? 0} />
        <MetricCard label="Webhook Deliveries" value={overview?.metrics.webhookTotal ?? 0} />
        <MetricCard label="PDF Queue Failures" value={overview?.metrics.pdfQueueFailures ?? 0} />
        <MetricCard label="Payments Created" value={overview?.metrics.paymentsCreated ?? 0} />
        <MetricCard label="Payments Completed" value={overview?.metrics.paymentsCompleted ?? 0} />
        <MetricCard
          label="Payments Completed Amount"
          value={`$${(overview?.metrics.paymentsCompletedAmount ?? 0).toFixed(2)}`}
        />
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Per-document analytics</h2>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
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
        </div>

        {selectedAnalytics ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-border bg-background p-3 text-sm">
              <p className="font-medium">Timeline</p>
              <p className="text-xs text-muted">Sent: {formatDate(selectedAnalytics.analytics.timeline.sentAt)}</p>
              <p className="text-xs text-muted">Viewed: {formatDate(selectedAnalytics.analytics.timeline.viewedAt)}</p>
              <p className="text-xs text-muted">
                Finalized: {formatDate(selectedAnalytics.analytics.timeline.finalizedAt)}
              </p>
              <p className="text-xs text-muted">
                PDF Stored: {formatDate(selectedAnalytics.analytics.timeline.pdfStoredAt)}
              </p>
            </div>
            <div className="rounded border border-border bg-background p-3 text-sm">
              <p className="font-medium">Durations</p>
              <p className="text-xs text-muted">
                Sent -&gt; Finalized: {formatDuration(selectedAnalytics.analytics.durationsMs.sentToFinalizedMs)}
              </p>
              <p className="text-xs text-muted">
                Viewed -&gt; Finalized: {formatDuration(selectedAnalytics.analytics.durationsMs.viewedToFinalizedMs)}
              </p>
            </div>
            <div className="rounded border border-border bg-background p-3 text-sm md:col-span-2">
              <p className="font-medium">Webhook Deliveries</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedAnalytics.analytics.webhookDeliveries.map((row) => (
                  <span key={row.status} className="rounded border border-border px-2 py-1 text-xs">
                    {row.status}: {row.count}
                  </span>
                ))}
                {selectedAnalytics.analytics.webhookDeliveries.length === 0 ? (
                  <span className="text-xs text-muted">No webhook deliveries for this document.</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Select a document to inspect lifecycle metrics.</p>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
