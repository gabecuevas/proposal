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

  return (
    <main className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="text-3xl font-semibold">Workspace Dashboard</h1>
        <p className="mt-3 text-muted">Track document lifecycle events and trigger sending.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(summary?.counts ?? {}).map(([statusKey, count]) => (
            <Link
              key={statusKey}
              href={`/app?status=${encodeURIComponent(statusKey)}`}
              className="rounded-lg border border-border bg-surface p-3 text-sm hover:bg-background"
            >
              <p className="text-xs text-muted">{statusKey}</p>
              <p className="text-xl font-semibold">{count}</p>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <div className="mt-2 space-y-2">
              {(summary?.recentActivity ?? []).slice(0, 5).map((event) => (
                <div key={event.id} className="rounded border border-border bg-background p-2 text-xs">
                  <p className="font-medium">{event.event_type}</p>
                  <p className="text-muted">
                    {event.document_id} - {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {(summary?.recentActivity?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted">No workspace activity yet.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Recent documents</h2>
            <div className="mt-2 space-y-2">
              {(summary?.recentDocuments ?? []).slice(0, 5).map((document) => (
                <button
                  key={document.id}
                  onClick={() => setSelectedDocumentId(document.id)}
                  className="w-full rounded border border-border bg-background p-2 text-left text-xs hover:bg-surface"
                >
                  <p className="font-medium">{document.id}</p>
                  <p className="text-muted">
                    {document.status} - {new Date(document.updated_at).toLocaleString()}
                  </p>
                </button>
              ))}
              {(summary?.recentDocuments?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted">No documents yet.</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => void createProposalForDemo()}
            disabled={creatingProposal}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-60"
          >
            {creatingProposal ? "Creating proposal..." : "Create proposal from template"}
          </button>
        </div>
        {status ? <p className="mt-2 text-sm text-green-600">{status}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <select
              className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={selectedDocumentId}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
            >
              <option value="">{statusFilter ? `Select a ${statusFilter} document` : "Select a document"}</option>
              {filteredDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.id} ({document.status})
                </option>
              ))}
            </select>
            <button
              onClick={() => void reloadDocuments()}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Refresh
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void sendSelectedDocument()}
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Send document
            </button>
            <button
              onClick={() => void createCheckoutSession()}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Create checkout
            </button>
            <button
              onClick={() => void requestApproval()}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Request approval
            </button>
            <button
              onClick={() => void decideApproval("APPROVED")}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Approve
            </button>
            <button
              onClick={() => void decideApproval("REJECTED")}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Reject
            </button>
          </div>
          <div className="rounded border border-border bg-background p-2 text-sm">
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
                Latest approval: {latestApproval.status} at {new Date(latestApproval.created_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div className="rounded border border-border bg-background p-2 text-sm">
            <p className="mb-1 font-medium">Payments</p>
            {payments.length === 0 ? <p className="text-xs text-muted">No payment attempts yet.</p> : null}
            {payments.map((payment) => (
              <p key={payment.id} className="text-xs text-muted">
                {payment.provider} {payment.status} - {(payment.amount_minor / 100).toFixed(2)} {payment.currency} -{" "}
                {new Date(payment.created_at).toLocaleString()}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={comment}
              placeholder="Add internal comment"
              onChange={(event) => setComment(event.target.value)}
            />
            <button
              onClick={() => void commentSelectedDocument()}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Comment
            </button>
          </div>
        </div>
      </section>
      <aside className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Activity Feed</h2>
        {events.length === 0 ? <p className="text-sm text-muted">No events yet.</p> : null}
        {events.map((event) => (
          <div key={event.id} className="rounded border border-border p-2 text-sm">
            <p className="font-medium">{event.event_type}</p>
            <p className="text-xs text-muted">{new Date(event.created_at).toLocaleString()}</p>
          </div>
        ))}
      </aside>
    </main>
  );
}
