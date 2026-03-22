import { calculateQuoteTotals } from "../editor/quote";
import type { PricingModel } from "../editor/types";

type LifecycleEventType = "DOCUMENT_SENT" | "DOCUMENT_VIEWED" | "DOCUMENT_FINALIZED";

type LifecycleEvent = {
  document_id: string;
  event_type: LifecycleEventType;
  created_at: Date;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeRevenueFromPaidDocuments(input: Array<{ pricing_json: PricingModel }>): number {
  return input.reduce((sum, row) => {
    const totals = calculateQuoteTotals(row.pricing_json);
    return sum + totals.totalDueNow;
  }, 0);
}

export function computeLifecycleMetrics(events: LifecycleEvent[]) {
  const byDocument = new Map<
    string,
    {
      sentAt?: Date;
      viewedAt?: Date;
      finalizedAt?: Date;
    }
  >();

  for (const event of events) {
    const current = byDocument.get(event.document_id) ?? {};
    if (event.event_type === "DOCUMENT_SENT") {
      current.sentAt = current.sentAt ?? event.created_at;
    }
    if (event.event_type === "DOCUMENT_VIEWED") {
      current.viewedAt = current.viewedAt ?? event.created_at;
    }
    if (event.event_type === "DOCUMENT_FINALIZED") {
      current.finalizedAt = current.finalizedAt ?? event.created_at;
    }
    byDocument.set(event.document_id, current);
  }

  const timeToSignValues: number[] = [];
  let viewedDocs = 0;
  let signedFromViewed = 0;

  for (const lifecycle of byDocument.values()) {
    if (lifecycle.viewedAt) {
      viewedDocs += 1;
    }
    if (lifecycle.sentAt && lifecycle.finalizedAt) {
      const durationMs = lifecycle.finalizedAt.getTime() - lifecycle.sentAt.getTime();
      if (durationMs >= 0) {
        timeToSignValues.push(durationMs);
      }
    }
    if (lifecycle.viewedAt && lifecycle.finalizedAt) {
      signedFromViewed += 1;
    }
  }

  const avgTimeToSignMs = average(timeToSignValues);
  const viewToSignRate = viewedDocs > 0 ? signedFromViewed / viewedDocs : null;

  return {
    trackedDocuments: byDocument.size,
    viewedDocs,
    signedFromViewed,
    avgTimeToSignMs,
    viewToSignRate,
  };
}
