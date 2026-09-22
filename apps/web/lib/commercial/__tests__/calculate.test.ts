import { describe, expect, it } from "vitest";
import {
  calculateCommercialTotals,
  formatMoneyMinor,
  validateCommercialDocument,
} from "../calculate";
import { createBlankCommercialDocument, createBlankLineItem, QUANTITY_SCALE, PERCENT_SCALE } from "../schema";

describe("calculateCommercialTotals", () => {
  it("matches the known fixture: lines, 10% discount, 8% tax, shipping, payment", () => {
    const doc = createBlankCommercialDocument("invoice", { currency: "USD" });
    doc.lineItems = [
      { id: "a", description: "A", quantityScaled: 2 * QUANTITY_SCALE, rateMinor: 10000 },
      { id: "b", description: "B", quantityScaled: 1 * QUANTITY_SCALE, rateMinor: 5000 },
    ];
    doc.discount = { enabled: true, mode: "percent", valueScaled: 10 * PERCENT_SCALE };
    doc.tax = { enabled: true, mode: "percent", valueScaled: 8 * PERCENT_SCALE };
    doc.shipping = { enabled: true, mode: "fixed", valueScaled: 1500 };
    doc.amountPaidMinor = 10000;

    const totals = calculateCommercialTotals({ document: doc });
    expect(totals.subtotalMinor).toBe(25000);
    expect(totals.discountMinor).toBe(2500);
    expect(totals.discountedSubtotalMinor).toBe(22500);
    expect(totals.taxMinor).toBe(1800);
    expect(totals.shippingMinor).toBe(1500);
    expect(totals.totalMinor).toBe(25800);
    expect(totals.amountPaidMinor).toBe(10000);
    expect(totals.balanceDueMinor).toBe(15800);
  });

  it("supports fractional quantities and zero-decimal currencies", () => {
    const doc = createBlankCommercialDocument("quote", { currency: "JPY" });
    doc.lineItems = [
      { id: "a", description: "Widget", quantityScaled: Math.round(1.5 * QUANTITY_SCALE), rateMinor: 100 },
    ];
    const totals = calculateCommercialTotals({ document: doc });
    expect(totals.subtotalMinor).toBe(150);
    expect(formatMoneyMinor(totals.subtotalMinor, "JPY")).toContain("150");
  });

  it("supports three-decimal currencies", () => {
    const doc = createBlankCommercialDocument("quote", { currency: "BHD" });
    doc.lineItems = [
      { id: "a", description: "Svc", quantityScaled: QUANTITY_SCALE, rateMinor: 1250 },
    ];
    const totals = calculateCommercialTotals({ document: doc });
    expect(totals.subtotalMinor).toBe(1250);
    expect(totals.precision).toBe(3);
  });

  it("rejects invalid discount percent and excessive fixed discount", () => {
    const doc = createBlankCommercialDocument("quote");
    doc.lineItems = [{ id: "a", description: "A", quantityScaled: QUANTITY_SCALE, rateMinor: 1000 }];
    doc.discount = { enabled: true, mode: "percent", valueScaled: 150 * PERCENT_SCALE };
    expect(validateCommercialDocument(doc).some((i) => i.code === "discount_percent_range")).toBe(true);

    doc.discount = { enabled: true, mode: "fixed", valueScaled: 5000 };
    expect(validateCommercialDocument(doc).some((i) => i.code === "discount_exceeds_subtotal")).toBe(true);
  });

  it("ignores blank placeholder rows for send validation but requires a real item", () => {
    const doc = createBlankCommercialDocument("quote");
    doc.lineItems = [createBlankLineItem()];
    expect(validateCommercialDocument(doc, { forSend: true }).some((i) => i.code === "items_required")).toBe(
      true,
    );
  });

  it("shows credit (negative balance) on overpayment rather than clamping to zero", () => {
    const doc = createBlankCommercialDocument("invoice");
    doc.lineItems = [{ id: "a", description: "A", quantityScaled: QUANTITY_SCALE, rateMinor: 5000 }];
    doc.amountPaidMinor = 8000;
    const totals = calculateCommercialTotals({ document: doc });
    expect(totals.totalMinor).toBe(5000);
    expect(totals.balanceDueMinor).toBe(-3000);
  });
});
