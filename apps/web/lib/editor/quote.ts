import type { PricingModel, QuoteLineItem, QuoteTotals } from "./types";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineTotal(item: QuoteLineItem): number {
  if (item.optional && item.selected !== true) {
    return 0;
  }
  return roundMoney(item.quantity * item.unitPrice);
}

export function calculateQuoteTotals(pricing: PricingModel): QuoteTotals {
  const oneTimeSubtotal = roundMoney(
    pricing.items
      .filter((item) => !item.recurring)
      .reduce((sum, item) => sum + lineTotal(item), 0),
  );

  const recurringMonthlySubtotal = roundMoney(
    pricing.items
      .filter((item) => item.recurring?.interval === "month")
      .reduce((sum, item) => sum + lineTotal(item), 0),
  );

  const recurringYearlySubtotal = roundMoney(
    pricing.items
      .filter((item) => item.recurring?.interval === "year")
      .reduce((sum, item) => sum + lineTotal(item), 0),
  );

  const discountAmount = roundMoney(oneTimeSubtotal * ((pricing.discountPercent ?? 0) / 100));
  const taxableBase = roundMoney(oneTimeSubtotal - discountAmount);
  const taxAmount = roundMoney(taxableBase * ((pricing.taxPercent ?? 0) / 100));
  const totalDueNow = roundMoney(taxableBase + taxAmount);

  return {
    oneTimeSubtotal,
    recurringMonthlySubtotal,
    recurringYearlySubtotal,
    discountAmount,
    taxAmount,
    totalDueNow,
  };
}
