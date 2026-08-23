"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DocumentSummary = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  created_at: string;
};

type ApprovalSummary = {
  discountPercent: number;
  thresholdPercent: number;
  approvalRequired: boolean;
  canSend: boolean;
};

type ApprovalRecord = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  decided_at: string | null;
  requested_reason: string | null;
  decided_reason: string | null;
};

type PaymentRecord = {
  id: string;
  provider: string;
  status: string;
  amount_minor: number;
  currency: string;
  checkout_url: string | null;
  paid_at: string | null;
  created_at: string;
};

type DashboardSummary = {
  counts: Record<string, number>;
  recentDocuments: DocumentSummary[];
  recentActivity: Array<{
    id: string;
    document_id: string;
    event_type: string;
    created_at: string;
  }>;
};

export default function AppHomePage() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [comment, setComment] = useState("");
  const [approvalSummary, setApprovalSummary] = useState<ApprovalSummary | null>(null);
  const [latestApproval, setLatestApproval] = useState<ApprovalRecord | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const statusFilter = searchParams.get("status")?.toUpperCase() ?? "";

  async function reloadDocuments() {
    const response = await fetch("/api/documents");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { documents: DocumentSummary[] };
    setDocuments(payload.documents);
    setSelectedDocumentId((current) => current || payload.documents[0]?.id || "");
  }

  async function reloadSummary() {
    const response = await fetch("/api/dashboard/summary");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as DashboardSummary;
    setSummary(payload);
  }

  async function reloadActivity(documentId: string) {
    if (!documentId) {
      setEvents([]);
      return;
    }

    const response = await fetch(`/api/documents/${documentId}/activity`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { events: ActivityEvent[] };
    setEvents(payload.events);
  }

  async function sendSelectedDocument() {
    setStatus("");
    setError("");
    if (!selectedDocumentId) {
      return;
    }
    const response = await fetch(`/api/documents/${selectedDocumentId}/send`, { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Failed to send document.");
      return;
    }
    setStatus("Document sent.");
    await reloadDocuments();
    await reloadSummary();
    await reloadActivity(selectedDocumentId);
    await reloadApproval(selectedDocumentId);
  }

  async function commentSelectedDocument() {
    if (!selectedDocumentId || !comment.trim()) {
      return;
    }
    await fetch(`/api/documents/${selectedDocumentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: comment.trim() }),
    });
    setComment("");
    await reloadDocuments();
    await reloadSummary();
    await reloadActivity(selectedDocumentId);
  }

  async function reloadApproval(documentId: string) {
    if (!documentId) {
      setApprovalSummary(null);
      setLatestApproval(null);
      return;
    }
    const response = await fetch(`/api/documents/${documentId}/approval`);
    if (!response.ok) {
      setApprovalSummary(null);
      setLatestApproval(null);
      return;
    }
    const payload = (await response.json()) as {
      summary: ApprovalSummary;
      approval: ApprovalRecord | null;
    };
    setApprovalSummary(payload.summary);
    setLatestApproval(payload.approval);
  }

  async function reloadPayments(documentId: string) {
    if (!documentId) {
      setPayments([]);
      return;
    }
    const response = await fetch(`/api/documents/${documentId}/payments`);
    if (!response.ok) {
      setPayments([]);
      return;
    }
    const payload = (await response.json()) as { payments: PaymentRecord[] };
    setPayments(payload.payments);
  }

  async function requestApproval() {
    setStatus("");
    setError("");
    if (!selectedDocumentId) {
      return;
    }
    const reason = window.prompt("Reason for approval request (optional)") ?? "";
    const response = await fetch(`/api/documents/${selectedDocumentId}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Failed to request approval.");
      return;
    }
    setStatus("Approval requested.");
    await reloadSummary();
    await reloadApproval(selectedDocumentId);
    await reloadActivity(selectedDocumentId);
  }

  async function decideApproval(decision: "APPROVED" | "REJECTED") {
    setStatus("");
    setError("");
    if (!selectedDocumentId) {
      return;
    }
    const reason = window.prompt(`Reason for ${decision.toLowerCase()} decision (optional)`) ?? "";
    const response = await fetch(`/api/documents/${selectedDocumentId}/approval/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Failed to update approval.");
      return;
    }
    setStatus(`Approval ${decision.toLowerCase()}.`);
    await reloadSummary();
    await reloadApproval(selectedDocumentId);
    await reloadActivity(selectedDocumentId);
  }

  async function createCheckoutSession() {
    setStatus("");
    setError("");
    if (!selectedDocumentId) {
      return;
    }
    const response = await fetch(`/api/documents/${selectedDocumentId}/checkout-session`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | { session?: { checkoutUrl?: string }; error?: { message?: string } }
      | null;
    if (!response.ok) {
      setError(payload?.error?.message ?? "Failed to create checkout session.");
      return;
    }
    const checkoutUrl = payload?.session?.checkoutUrl;
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      setStatus("Checkout session created. Opened in new tab.");
    } else {
      setStatus("Checkout session created.");
    }
    await reloadPayments(selectedDocumentId);
    await reloadActivity(selectedDocumentId);
    await reloadDocuments();
    await reloadSummary();
  }

  async function createProposalForDemo() {
    setStatus("");
    setError("");
    setCreatingProposal(true);

    try {
      const templatesResponse = await fetch("/api/templates?limit=1");
      let templateId = "";

      if (templatesResponse.ok) {
        const templatesPayload = (await templatesResponse.json()) as {
          templates?: Array<{ id: string }>;
        };
        templateId = templatesPayload.templates?.[0]?.id ?? "";
      }

      if (!templateId) {
        const createTemplateResponse = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "First Proposal Template" }),
        });
        if (!createTemplateResponse.ok) {
          const payload = (await createTemplateResponse.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          setError(payload?.error?.message ?? "Could not create template for proposal.");
          return;
        }
        const templatePayload = (await createTemplateResponse.json()) as {
          template?: { id: string };
        };
        templateId = templatePayload.template?.id ?? "";
      }

      if (!templateId) {
        setError("No template available to create a proposal.");
        return;
      }

      const createDocumentResponse = await fetch("/api/documents/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!createDocumentResponse.ok) {
        const payload = (await createDocumentResponse.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "Failed to create proposal.");
        return;
      }

      const documentPayload = (await createDocumentResponse.json()) as {
        document?: { id: string };
      };
      const nextDocumentId = documentPayload.document?.id ?? "";
      if (nextDocumentId) {
        setSelectedDocumentId(nextDocumentId);
      }

      setStatus("New proposal created from template.");
      await reloadDocuments();
      await reloadSummary();
      if (nextDocumentId) {
        await reloadActivity(nextDocumentId);
        await reloadApproval(nextDocumentId);
        await reloadPayments(nextDocumentId);
      }
    } finally {
      setCreatingProposal(false);
    }
  }

  useEffect(() => {
    void reloadDocuments();
    void reloadSummary();
  }, []);

  useEffect(() => {
    void reloadActivity(selectedDocumentId);
    void reloadApproval(selectedDocumentId);
    void reloadPayments(selectedDocumentId);
  }, [selectedDocumentId]);

  const filteredDocuments = useMemo(() => {
    if (!statusFilter) {
      return documents;
    }
    return documents.filter((document) => document.status.toUpperCase() === statusFilter);
  }, [documents, statusFilter]);

  const counts = summary?.counts ?? {};
  const statDrafts = counts.DRAFTED ?? 0;
  const statAction = counts.COMMENTED ?? 0;
  const statWaiting = (counts.SENT ?? 0) + (counts.VIEWED ?? 0);
  const statFinalized = (counts.SIGNED ?? 0) + (counts.PAID ?? 0) + (counts.EXPIRED ?? 0) + (counts.VOID ?? 0);

  const recent = summary?.recentDocuments ?? [];

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      {bannerVisible ? (
        <div className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50/90 px-4 py-3 text-sm text-foreground">
          <span className="text-sky-700" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </span>
          <p className="flex-1 text-sky-900/90">
            Save time with reusable templates – create once, reuse forever
          </p>
          <Link href="/app/templates/new" className="shrink-0 font-medium text-primary underline-offset-4 hover:underline">
            Create template
          </Link>
          <button
            type="button"
            onClick={() => setBannerVisible(false)}
            className="shrink-0 rounded p-1 text-sky-700 hover:bg-sky-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-app-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
          Welcome back
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded p-1.5 ${viewMode === "list" ? "bg-slate-100 text-foreground" : "text-muted"}`}
              aria-label="List view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded p-1.5 ${viewMode === "grid" ? "bg-slate-100 text-foreground" : "text-muted"}`}
              aria-label="Grid view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="13" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-border rounded-lg border border-border bg-surface md:grid-cols-4">
        {[
          { label: "Your drafts", value: statDrafts, suffix: "docs" },
          { label: "Action required", value: statAction, suffix: "docs" },
          { label: "Waiting for others", value: statWaiting, suffix: "docs" },
          { label: "Finalized", value: statFinalized, suffix: "docs" },
        ].map((cell) => (
          <div key={cell.label} className="px-4 py-4 text-center md:text-left">
            <p className="text-xs font-medium text-muted">{cell.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {cell.value} <span className="text-sm font-normal text-muted">{cell.suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
          <div className="mb-6 rounded-2xl bg-sky-50 p-6 text-sky-600" aria-hidden>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <h2 className="font-app-serif text-xl font-normal text-foreground md:text-2xl">
            Start here — or pick up where you left off
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Create your first document, or return here to continue with any unsent documents.
          </p>
          <Link
            href="/app/proposals/new"
            className="mt-6 rounded-md border border-primary bg-surface px-5 py-2.5 text-sm font-medium text-primary hover:bg-slate-50"
          >
            + Create document
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((document) => (
            <Link
              key={document.id}
              href={`/app/documents/${document.id}`}
              className="rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs text-muted">{document.status}</p>
              <p className="mt-1 font-medium text-foreground">{document.id}</p>
              <p className="mt-2 text-xs text-muted">
                Updated {new Date(document.updated_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((document) => (
                <tr key={document.id} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/app/documents/${document.id}`} className="font-medium text-primary hover:underline">
                      {document.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{document.status}</td>
                  <td className="px-4 py-3 text-muted">{new Date(document.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status ? <p className="text-sm text-green-700">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Advanced workspace tools
            <span className="text-xs font-normal text-muted group-open:hidden">Show</span>
            <span className="hidden text-xs font-normal text-muted group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-xs text-muted">
            Send, approvals, checkout, and per-document activity — same behavior as before.
          </p>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                >
                  <option value="">
                    {statusFilter ? `Select a ${statusFilter} document` : "Select a document"}
                  </option>
                  {filteredDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.id} ({document.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void reloadDocuments()}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Refresh
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void sendSelectedDocument()}
                  className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                >
                  Send document
                </button>
                <button
                  type="button"
                  onClick={() => void createCheckoutSession()}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Create checkout
                </button>
                <button
                  type="button"
                  onClick={() => void requestApproval()}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Request approval
                </button>
                <button
                  type="button"
                  onClick={() => void decideApproval("APPROVED")}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void decideApproval("REJECTED")}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void createProposalForDemo()}
                  disabled={creatingProposal}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background disabled:opacity-60"
                >
                  {creatingProposal ? "Creating…" : "Create proposal from template"}
                </button>
              </div>
              <div className="rounded-md border border-border bg-background p-3 text-sm">
                {approvalSummary ? (
                  <>
                    <p>
                      Discount: {approvalSummary.discountPercent.toFixed(2)}% | Threshold:{" "}
                      {approvalSummary.thresholdPercent.toFixed(2)}%
                    </p>
                    <p>
                      Approval required: {approvalSummary.approvalRequired ? "yes" : "no"} | Send eligible:{" "}
                      {approvalSummary.canSend ? "yes" : "no"}
                    </p>
                  </>
                ) : (
                  <p className="text-muted">No approval data yet.</p>
                )}
                {latestApproval ? (
                  <p className="mt-1 text-xs text-muted">
                    Latest approval: {latestApproval.status} at{" "}
                    {new Date(latestApproval.created_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-border bg-background p-3 text-sm">
                <p className="mb-1 font-medium">Payments</p>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted">No payment attempts yet.</p>
                ) : null}
                {payments.map((payment) => (
                  <p key={payment.id} className="text-xs text-muted">
                    {payment.provider} {payment.status} - {(payment.amount_minor / 100).toFixed(2)}{" "}
                    {payment.currency} - {new Date(payment.created_at).toLocaleString()}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-w-[160px] flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={comment}
                  placeholder="Add internal comment"
                  onChange={(event) => setComment(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void commentSelectedDocument()}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Comment
                </button>
              </div>
            </div>
            <aside className="rounded-lg border border-border bg-background p-3">
              <h2 className="text-sm font-semibold">Activity Feed</h2>
              {events.length === 0 ? <p className="mt-2 text-xs text-muted">No events yet.</p> : null}
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="rounded border border-border p-2 text-xs">
                    <p className="font-medium">{event.event_type}</p>
                    <p className="text-muted">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </details>
    </main>
  );
}
