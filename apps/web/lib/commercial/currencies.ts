import type { CommercialDocument } from "./schema";
import { currencyPrecision } from "./schema";

/** ISO 4217 codes offered for quotes, invoices, and the company default. */
export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CHF",
  "CNY",
  "HKD",
  "SGD",
  "INR",
  "MXN",
  "BRL",
  "ARS",
  "CLP",
  "COP",
  "PEN",
  "ZAR",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "TRY",
  "ILS",
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "EGP",
  "NGN",
  "KES",
  "KRW",
  "TWD",
  "THB",
  "MYR",
  "IDR",
  "PHP",
  "VND",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return (
    typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value.toUpperCase())
  );
}

export function normalizeCurrency(value: string | null | undefined): SupportedCurrency {
  const code = (value ?? "").trim().toUpperCase();
  return isSupportedCurrency(code) ? (code as SupportedCurrency) : DEFAULT_CURRENCY;
}

/** "EUR — Euro". Falls back to the code when Intl has no display name. */
export function currencyLabel(code: string, locale = "en-US"): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code);
    return name && name !== code ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}

/** Short symbol for input adornments: "$", "€", "£", "¥", "CHF". */
export function currencySymbol(code: string, locale = "en-US"): string {
  try {
    const part = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

function rescale(minor: number, shift: number): number {
  if (shift === 0) {
    return minor;
  }
  return shift > 0 ? minor * 10 ** shift : Math.round(minor / 10 ** -shift);
}

/**
 * Switch a document to another currency, keeping the typed amounts
 * (1,500.00 USD → 1,500 JPY) by rescaling minor units between precisions.
 * No exchange-rate conversion is applied.
 */
export function withDocumentCurrency(doc: CommercialDocument, nextCurrency: string): CommercialDocument {
  const currency = nextCurrency.toUpperCase();
  const shift = currencyPrecision(currency) - currencyPrecision(doc.currency);
  const adjust = <T extends CommercialDocument["discount"]>(adjustment: T): T =>
    adjustment.mode === "fixed" ? { ...adjustment, valueScaled: rescale(adjustment.valueScaled, shift) } : adjustment;
  return {
    ...doc,
    currency,
    lineItems: doc.lineItems.map((item) => ({ ...item, rateMinor: rescale(item.rateMinor, shift) })),
    discount: adjust(doc.discount),
    tax: adjust(doc.tax),
    shipping: adjust(doc.shipping),
    amountPaidMinor: rescale(doc.amountPaidMinor, shift),
  };
}
