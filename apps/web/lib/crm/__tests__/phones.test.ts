import { describe, expect, it } from "vitest";
import {
  normalizePhones,
  parsePhones,
  primaryPhoneNumber,
  syncPhonesWithScalar,
  validatePhones,
} from "@/lib/crm/phones";

describe("phones helpers", () => {
  it("parses legacy scalar when phones json is empty", () => {
    const phones = parsePhones(null, "555-0100");
    expect(phones).toHaveLength(1);
    expect(phones[0]?.number).toBe("555-0100");
    expect(phones[0]?.type).toBe("work");
    expect(phones[0]?.primary).toBe(true);
  });

  it("puts primary first and keeps one primary", () => {
    const phones = normalizePhones([
      { id: "a", number: "1111111", type: "home", primary: false },
      { id: "b", number: "2222222", type: "mobile", primary: true },
    ]);
    expect(phones[0]?.id).toBe("b");
    expect(phones.filter((p) => p.primary)).toHaveLength(1);
  });

  it("syncs scalar phone onto primary entry", () => {
    const next = syncPhonesWithScalar(
      [
        { id: "a", number: "1111111", type: "work", primary: true },
        { id: "b", number: "2222222", type: "mobile", primary: false },
      ],
      "3333333",
    );
    expect(primaryPhoneNumber(next)).toBe("3333333");
    expect(next).toHaveLength(2);
  });

  it("validates required phones", () => {
    expect(validatePhones([], { required: true })).toBe("Phone is required");
    expect(validatePhones([{ id: "a", number: "123", type: "work", primary: true }])).toMatch(
      /valid phone/i,
    );
    expect(
      validatePhones([{ id: "a", number: "555-123-4567", type: "work", primary: true }]),
    ).toBeNull();
  });
});
