import { describe, expect, it } from "vitest";
import { formatDocumentNumber, parseDocumentNumber, sameNumberSeries } from "../number-format";

describe("parseDocumentNumber", () => {
  it("parses plain numbers", () => {
    expect(parseDocumentNumber("20")).toEqual({ prefix: "", suffix: "", padWidth: 0, value: 20 });
  });

  it("keeps prefix and zero padding", () => {
    expect(parseDocumentNumber("SD-0034")).toEqual({ prefix: "SD-", suffix: "", padWidth: 4, value: 34 });
  });

  it("uses the last run of digits and keeps a suffix", () => {
    expect(parseDocumentNumber("INV-2026-007-A")).toEqual({
      prefix: "INV-2026-",
      suffix: "-A",
      padWidth: 3,
      value: 7,
    });
  });

  it("returns null when there is nothing to increment", () => {
    expect(parseDocumentNumber("DRAFT")).toBeNull();
    expect(parseDocumentNumber("")).toBeNull();
    expect(parseDocumentNumber("99999999999")).toBeNull();
  });
});

describe("formatDocumentNumber", () => {
  it("continues a custom series", () => {
    const parsed = parseDocumentNumber("SD-0034")!;
    expect(formatDocumentNumber(parsed.value + 1, parsed)).toBe("SD-0035");
  });

  it("grows past the pad width", () => {
    expect(formatDocumentNumber(10000, { prefix: "SD-", suffix: "", padWidth: 4 })).toBe("SD-10000");
  });

  it("continues plain numbers", () => {
    expect(formatDocumentNumber(21, { prefix: "", suffix: "", padWidth: 0 })).toBe("21");
  });
});

describe("sameNumberSeries", () => {
  it("compares prefix and suffix only", () => {
    expect(sameNumberSeries(parseDocumentNumber("SD-0034")!, parseDocumentNumber("SD-9")!)).toBe(true);
    expect(sameNumberSeries(parseDocumentNumber("SD-0034")!, parseDocumentNumber("34")!)).toBe(false);
  });
});
