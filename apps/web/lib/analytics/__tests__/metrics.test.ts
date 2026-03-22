import { describe, expect, test } from "vitest";
import { computeLifecycleMetrics, computeRevenueFromPaidDocuments } from "../metrics";

describe("analytics metrics", () => {
  test("computes lifecycle conversion and time-to-sign", () => {
    const now = Date.now();
    const result = computeLifecycleMetrics([
      { document_id: "d1", event_type: "DOCUMENT_SENT", created_at: new Date(now) },
      { document_id: "d1", event_type: "DOCUMENT_VIEWED", created_at: new Date(now + 5_000) },
      { document_id: "d1", event_type: "DOCUMENT_FINALIZED", created_at: new Date(now + 20_000) },
      { document_id: "d2", event_type: "DOCUMENT_SENT", created_at: new Date(now + 1_000) },
      { document_id: "d2", event_type: "DOCUMENT_VIEWED", created_at: new Date(now + 3_000) },
    ]);

    expect(result.trackedDocuments).toBe(2);
    expect(result.viewedDocs).toBe(2);
    expect(result.signedFromViewed).toBe(1);
    expect(result.avgTimeToSignMs).toBe(20_000);
    expect(result.viewToSignRate).toBe(0.5);
  });

  test("computes revenue totals from paid document pricing", () => {
    const revenue = computeRevenueFromPaidDocuments([
      {
        pricing_json: {
          currency: "USD",
          discountPercent: 10,
          taxPercent: 10,
          items: [{ id: "a", name: "Setup", quantity: 1, unitPrice: 100 }],
        },
      },
      {
        pricing_json: {
          currency: "USD",
          discountPercent: 0,
          taxPercent: 0,
          items: [{ id: "b", name: "Support", quantity: 2, unitPrice: 50 }],
        },
      },
    ]);
    expect(revenue).toBe(199);
  });
});
