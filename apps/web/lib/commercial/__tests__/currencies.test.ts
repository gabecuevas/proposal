import { describe, expect, it } from "vitest";
import {
  currencySymbol,
  isSupportedCurrency,
  normalizeCurrency,
  withDocumentCurrency,
} from "../currencies";
import { createBlankCommercialDocument } from "../schema";

function sampleDoc(currency: string) {
  const doc = createBlankCommercialDocument("invoice", { currency });
  return {
    ...doc,
    lineItems: [{ ...doc.lineItems[0]!, rateMinor: 150_000 }],
    discount: { enabled: true, mode: "fixed" as const, valueScaled: 1_000 },
    tax: { enabled: true, mode: "percent" as const, valueScaled: 825 },
    shipping: { enabled: true, mode: "fixed" as const, valueScaled: 2_500 },
    amountPaidMinor: 5_000,
  };
}

describe("currencies", () => {
  it("validates and normalizes codes", () => {
    expect(isSupportedCurrency("eur")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(normalizeCurrency(" gbp ")).toBe("GBP");
    expect(normalizeCurrency(null)).toBe("USD");
    expect(normalizeCurrency("XYZ")).toBe("USD");
  });

  it("returns short symbols", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("GBP")).toBe("£");
  });

  it("keeps amounts when switching between same-precision currencies", () => {
    const next = withDocumentCurrency(sampleDoc("USD"), "eur");
    expect(next.currency).toBe("EUR");
    expect(next.lineItems[0]!.rateMinor).toBe(150_000);
    expect(next.shipping.valueScaled).toBe(2_500);
  });

  it("rescales minor units across precisions, leaving percentages alone", () => {
    const yen = withDocumentCurrency(sampleDoc("USD"), "JPY");
    expect(yen.lineItems[0]!.rateMinor).toBe(1_500);
    expect(yen.discount.valueScaled).toBe(10);
    expect(yen.tax.valueScaled).toBe(825);
    expect(yen.shipping.valueScaled).toBe(25);
    expect(yen.amountPaidMinor).toBe(50);

    const dinar = withDocumentCurrency(yen, "KWD");
    expect(dinar.lineItems[0]!.rateMinor).toBe(1_500_000);
    expect(dinar.tax.valueScaled).toBe(825);
  });
});
