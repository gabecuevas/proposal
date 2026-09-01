import { describe, expect, it } from "vitest";
import { duplicateSearchReady } from "@/lib/crm/duplicate-search";
import { normalizePhoneDigits, phonesEquivalent, phoneSearchSuffix } from "@/lib/crm/phone-normalize";

describe("phone-normalize", () => {
  it("strips non-digits", () => {
    expect(normalizePhoneDigits("(408) 847-2424")).toBe("4088472424");
  });

  it("builds a 7-digit search suffix", () => {
    expect(phoneSearchSuffix("4088472424")).toBe("8472424");
    expect(phoneSearchSuffix("123")).toBeNull();
  });

  it("matches equivalent phone formats", () => {
    expect(phonesEquivalent("408-847-2424", "+1 (408) 847-2424")).toBe(true);
    expect(phonesEquivalent("4088472424", "5551234567")).toBe(false);
  });
});

describe("duplicateSearchReady", () => {
  it("requires meaningful input before searching", () => {
    expect(duplicateSearchReady("email", "a@b")).toBe(true);
    expect(duplicateSearchReady("email", "ab")).toBe(false);
    expect(duplicateSearchReady("phone", "4088472")).toBe(true);
    expect(duplicateSearchReady("name", "A")).toBe(false);
    expect(duplicateSearchReady("name", "Acme")).toBe(true);
  });
});
