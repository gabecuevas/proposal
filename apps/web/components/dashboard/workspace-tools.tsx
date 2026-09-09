"use client";

import { useCallback, useEffect, useState } from "react";

type DocumentSummary = {
  id: string;
  status: string;
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
};

type PaymentRecord = {
  id: string;
  provider: string;
  status: string;
  amount_minor: number;
  currency: string;
  created_at: string;
};

type ApiErrorPayload = { error?: { message?: string } } | null;

/**
 * Send, approval, checkout and comment controls. Kept out of the dashboard's main
 * layout because it is the only surface for these actions outside the API.
 */
export function WorkspaceTools() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [comment, setComment] = useState("");
  const [approvalSummary, setApprovalSummary] = useState<ApprovalSummary | null>(null);
  const [latestApproval, setLatestApproval] = useState<ApprovalRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const reloadDocuments = useCallback(async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { documents: DocumentSummary[] };
    setDocuments(payload.documents);
    setSelectedDocumentId((current) => current || payload.documents[0]?.id || "");
  }, []);

  const reloadActivity = useCallback(async (documentId: string) => {
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
  }, []);

  const reloadApproval = useCallback(async (documentId: string) => {
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
  }, []);

  const reloadPayments = useCallback(async (documentId: string) => {
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
  }, []);

  useEffect(() => {
    void reloadDocuments();
  }, [reloadDocuments]);

  useEffect(() => {
    void reloadActivity(selectedDocumentId);
    void reloadApproval(selectedDocumentId);
    void reloadPayments(selectedDocumentId);
  }, [selectedDocumentId, reloadActivity, reloadApproval, reloadPayments]);

  async function refreshSelected() {
    await reloadDocuments();
    await reloadActivity(selectedDocumentId);
    await reloadApproval(selectedDocumentId);
    await reloadPayments(selectedDocumentId);
  }

  async function sendSelectedDocument() {
    setStatus("");
    setError("");
    if (!selectedDocumentId) {
      return;
    }
    const response = await fetch(`/api/documents/${selectedDocumentId}/send`, { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload;
      setError(payload?.error?.message ?? "Failed to send document.");
      return;
    }
    setStatus("Document sent.");
    await refreshSelected();
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
    await refreshSelected();
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
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload;
      setError(payload?.error?.message ?? "Failed to request approval.");
      return;
    }
    setStatus("Approval requested.");
    await refreshSelected();
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
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload;
      setError(payload?.error?.message ?? "Failed to update approval.");
      return;
    }
    setStatus(`Approval ${decision.toLowerCase()}.`);
    await refreshSelected();
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
    await refreshSelected();
  }

  return (
    <details className="group border-t border-border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Advanced workspace tools
          <span className="text-xs font-normal text-muted group-open:hidden">Show</span>
          <span className="hidden text-xs font-normal text-muted group-open:inline">Hide</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-border p-4">
        <p className="text-xs text-muted">
          Send, approvals, checkout, and per-document activity.
        </p>
        {status ? <p className="text-sm text-green-700">{status}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={selectedDocumentId}
                onChange={(event) => setSelectedDocumentId(event.target.value)}
                aria-label="Select a document"
              >
                <option value="">Select a document</option>
                {documents.map((document) => (
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
            </div>

            <div className="rounded-md border border-border bg-background p-3 text-sm">
              {approvalSummary ? (
                <>
                  <p>
                    Discount: {approvalSummary.discountPercent.toFixed(2)}% | Threshold:{" "}
                    {approvalSummary.thresholdPercent.toFixed(2)}%
                  </p>
                  <p>
                    Approval required: {approvalSummary.approvalRequired ? "yes" : "no"} | Send
                    eligible: {approvalSummary.canSend ? "yes" : "no"}
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
            <h2 className="text-sm font-semibold">Document activity</h2>
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
  );
}
