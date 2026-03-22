import { describe, expect, test } from "vitest";
import { calculateQuoteTotals } from "../quote";

describe("calculateQuoteTotals", () => {
  test("handles one-time, recurring, optional items, discount, and tax", () => {
    const totals = calculateQuoteTotals({
      currency: "USD",
      discountPercent: 10,
      taxPercent: 8.25,
      items: [
        { id: "1", name: "Setup", quantity: 1, unitPrice: 1000 },
        { id: "2", name: "Optional Add-on", quantity: 1, unitPrice: 500, optional: true, selected: false },
        {
          id: "3",
          name: "Platform",
          quantity: 2,
          unitPrice: 50,
          recurring: { interval: "month" },
        },
      ],
    });

    expect(totals.oneTimeSubtotal).toBe(1000);
    expect(totals.recurringMonthlySubtotal).toBe(100);
    expect(totals.discountAmount).toBe(100);
    expect(totals.taxAmount).toBe(74.25);
    expect(totals.totalDueNow).toBe(974.25);
  });
});
