import { describe, expect, it } from "vitest";
import { historyFieldIconId } from "@/lib/crm/history-field-icon";

describe("historyFieldIconId", () => {
  it("maps phone and website field keys", () => {
    expect(historyFieldIconId({ fieldKey: "phones", kind: "change" })).toBe("phone");
    expect(historyFieldIconId({ fieldKey: "website", kind: "change" })).toBe("web");
    expect(historyFieldIconId({ fieldKey: "address", kind: "change" })).toBe("pin");
    expect(historyFieldIconId({ fieldKey: "email", kind: "change" })).toBe("mail");
  });

  it("falls back to title text when field key is missing", () => {
    expect(historyFieldIconId({ title: "Phone changed", kind: "change" })).toBe("phone");
    expect(historyFieldIconId({ title: "Website added", kind: "change" })).toBe("web");
    expect(historyFieldIconId({ title: "Person created", kind: "created" })).toBe("created");
  });
});
