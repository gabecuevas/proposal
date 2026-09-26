import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));

import { resolveCommercialToken } from "@/lib/commercial/variables";
import { fillEmptyVariables } from "../identity-variables";

describe("fillEmptyVariables", () => {
  it("fills missing and blank values", () => {
    const next = fillEmptyVariables(
      { title: "Invoice", Sender: { FullName: "  ", Phone: "555" } },
      { Sender: { FullName: "Gabe Cuevas", Phone: "999", Email: "gabe@example.com" } },
      ["Sender"],
    );
    expect(next).toEqual({
      title: "Invoice",
      Sender: { FullName: "Gabe Cuevas", Phone: "555", Email: "gabe@example.com" },
    });
  });

  it("returns the same object when nothing is missing", () => {
    const existing = { Recipient: { FullName: "Typed Name" } };
    expect(fillEmptyVariables(existing, { Recipient: { FullName: "CRM Name" } }, ["Recipient"])).toBe(
      existing,
    );
  });

  it("ignores namespaces that were not requested and empty incoming values", () => {
    const existing = {};
    const next = fillEmptyVariables(existing, { Sender: { FullName: "" }, Recipient: { FullName: "A" } }, [
      "Sender",
    ]);
    expect(next).toBe(existing);
  });
});

describe("resolveCommercialToken", () => {
  it("reads nested variable paths", () => {
    const context = { Recipient: { FullName: "Alicia Keys" }, Sender: { Phone: "555" } };
    expect(resolveCommercialToken("Recipient.FullName", context)).toBe("Alicia Keys");
    expect(resolveCommercialToken("Sender.Phone", context)).toBe("555");
  });

  it("still prefers flat keys", () => {
    expect(resolveCommercialToken("Sender.FullName", { "Sender.FullName": "Flat" })).toBe("Flat");
  });
});
