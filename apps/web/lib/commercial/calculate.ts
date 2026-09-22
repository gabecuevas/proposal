import {
  currencyPrecision,
  QUANTITY_SCALE,
  PERCENT_SCALE,
  type CommercialAdjustment,
  type CommercialDocument,
  type CommercialLineItem,
  type CommercialTotals,
  type MoneyMinor,
} from "./schema";

/**
 * Commercial calculation policy (v1).
 *
 * Distinct from legacy `lib/editor/quote.ts` (CPQ one-time/recurring model).
 *
 * Rounding: half-up to the currency's minor-unit precision after each
 * line amount and after each aggregate step.
 *
 * lineAmount = quantity × rate
 * subtotal = Σ lineAmount
 * discount = % of subtotal OR fixed
 * discountedSubtotal = subtotal − discount
 * tax = % of discountedSubtotal OR fixed
 * shipping = optional fixed (after tax)
 * total = discountedSubtotal + tax + shipping
 * balanceDue = total − amountPaid (invoice)
 */

function factor(precision: number): number {
  return 10 ** precision;
}

/** Half-up round for non-negative values into integer minor units. */
export function roundHalfUpToMinor(value: number, precision: number): MoneyMinor {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const f = factor(precision);
  return Math.round(value * f + Number.EPSILON);
}

export function lineAmountMinor(item: CommercialLineItem, precision: number): MoneyMinor {
  const quantity = item.quantityScaled / QUANTITY_SCALE;
  const rate = item.rateMinor / factor(precision);
  return roundHalfUpToMinor(quantity * rate, precision);
}

function adjustmentAmount(
  adjustment: CommercialAdjustment,
  baseMinor: MoneyMinor,
  precision: number,
): MoneyMinor {
  if (!adjustment.enabled) {
    return 0;
  }
  if (adjustment.mode === "fixed") {
    return Math.max(0, Math.trunc(adjustment.valueScaled));
  }
  const percent = adjustment.valueScaled / PERCENT_SCALE;
  const base = baseMinor / factor(precision);
  return roundHalfUpToMinor(base * (percent / 100), precision);
}

export type CalculateCommercialInput = {
  document: Pick<
    CommercialDocument,
    "currency" | "lineItems" | "discount" | "tax" | "shipping" | "amountPaidMinor" | "type"
  >;
  /** When set, overrides document.amountPaidMinor (e.g. payment ledger sum). */
  amountPaidMinorOverride?: MoneyMinor;
};

export function calculateCommercialTotals(input: CalculateCommercialInput): CommercialTotals {
  const { document } = input;
  const precision = currencyPrecision(document.currency);
  const subtotalMinor = document.lineItems.reduce(
    (sum, item) => sum + lineAmountMinor(item, precision),
    0,
  );
  const discountMinor = Math.min(
    subtotalMinor,
    adjustmentAmount(document.discount, subtotalMinor, precision),
  );
  const discountedSubtotalMinor = Math.max(0, subtotalMinor - discountMinor);
  const taxMinor = adjustmentAmount(document.tax, discountedSubtotalMinor, precision);
  const shippingMinor = document.shipping.enabled
    ? Math.max(0, Math.trunc(document.shipping.valueScaled))
    : 0;
  const totalMinor = discountedSubtotalMinor + taxMinor + shippingMinor;
  const amountPaidMinor =
    input.amountPaidMinorOverride !== undefined
      ? Math.max(0, Math.trunc(input.amountPaidMinorOverride))
      : Math.max(0, Math.trunc(document.amountPaidMinor));
  const balanceDueMinor = totalMinor - amountPaidMinor;

  return {
    subtotalMinor,
    discountMinor,
    discountedSubtotalMinor,
    taxMinor,
    shippingMinor,
    totalMinor,
    amountPaidMinor,
    balanceDueMinor,
    currency: document.currency.toUpperCase(),
    precision,
  };
}

export type CommercialValidationIssue = {
  code: string;
  message: string;
  field?: string;
  lineItemId?: string;
};

export function isBlankPlaceholderRow(item: CommercialLineItem): boolean {
  return (
    item.description.trim() === "" &&
    item.quantityScaled === QUANTITY_SCALE &&
    item.rateMinor === 0
  );
}

export function validateCommercialDocument(
  document: CommercialDocument,
  options?: { forSend?: boolean },
): CommercialValidationIssue[] {
  const issues: CommercialValidationIssue[] = [];
  const precision = currencyPrecision(document.currency);
  const forSend = options?.forSend === true;

  if (!document.currency || document.currency.length !== 3) {
    issues.push({ code: "currency", message: "Currency must be a 3-letter ISO code.", field: "currency" });
  }

  const activeItems = document.lineItems.filter((item) => !isBlankPlaceholderRow(item));
  if (forSend && activeItems.length === 0) {
    issues.push({
      code: "items_required",
      message: "Add at least one line item before sending.",
      field: "lineItems",
    });
  }

  for (const item of document.lineItems) {
    if (isBlankPlaceholderRow(item)) {
      continue;
    }
    if (item.quantityScaled < 0) {
      issues.push({
        code: "negative_quantity",
        message: "Quantity cannot be negative.",
        lineItemId: item.id,
        field: "quantity",
      });
    }
    if (item.rateMinor < 0) {
      issues.push({
        code: "negative_rate",
        message: "Rate cannot be negative.",
        lineItemId: item.id,
        field: "rate",
      });
    }
    if (!Number.isFinite(item.quantityScaled) || !Number.isFinite(item.rateMinor)) {
      issues.push({
        code: "nonfinite",
        message: "Quantity and rate must be finite numbers.",
        lineItemId: item.id,
      });
    }
    if (Math.abs(item.rateMinor) > 1_000_000_000_000) {
      issues.push({
        code: "rate_too_large",
        message: "Rate is too large.",
        lineItemId: item.id,
        field: "rate",
      });
    }
    if (forSend && item.description.trim() === "") {
      issues.push({
        code: "description_required",
        message: "Line item description is required.",
        lineItemId: item.id,
        field: "description",
      });
    }
  }

  if (document.discount.enabled && document.discount.mode === "percent") {
    const percent = document.discount.valueScaled / PERCENT_SCALE;
    if (percent < 0 || percent > 100) {
      issues.push({
        code: "discount_percent_range",
        message: "Discount percent must be between 0 and 100.",
        field: "discount",
      });
    }
  }

  if (document.tax.enabled && document.tax.mode === "percent") {
    const percent = document.tax.valueScaled / PERCENT_SCALE;
    if (percent < 0 || percent > 100) {
      issues.push({
        code: "tax_percent_range",
        message: "Tax percent must be between 0 and 100.",
        field: "tax",
      });
    }
  }

  if (document.shipping.enabled && document.shipping.valueScaled < 0) {
    issues.push({
      code: "negative_shipping",
      message: "Shipping cannot be negative.",
      field: "shipping",
    });
  }

  if (document.tax.enabled && document.tax.mode === "fixed" && document.tax.valueScaled < 0) {
    issues.push({ code: "negative_tax", message: "Tax cannot be negative.", field: "tax" });
  }

  const totals = calculateCommercialTotals({ document });
  if (document.discount.enabled && document.discount.mode === "fixed") {
    if (document.discount.valueScaled > totals.subtotalMinor) {
      issues.push({
        code: "discount_exceeds_subtotal",
        message: "Fixed discount cannot exceed subtotal.",
        field: "discount",
      });
    }
  }

  void precision;
  return issues;
}

export function formatMoneyMinor(
  amountMinor: MoneyMinor,
  currency: string,
  locale = "en-US",
): string {
  const precision = currencyPrecision(currency);
  const value = amountMinor / factor(precision);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(precision)}`;
  }
}

export function parseQuantityInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === ".") {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n * QUANTITY_SCALE);
}

export function parseMoneyInput(raw: string, currency: string): number | null {
  const trimmed = raw.replace(/[$,\s]/g, "").trim();
  if (trimmed === "" || trimmed === "-" || trimmed === ".") {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return roundHalfUpToMinor(n, currencyPrecision(currency));
}

export function quantityToDisplay(scaled: number): string {
  const value = scaled / QUANTITY_SCALE;
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(4)));
}

export function moneyMinorToDisplay(minor: number, currency: string): string {
  const precision = currencyPrecision(currency);
  const value = minor / factor(precision);
  return value.toFixed(precision);
}
