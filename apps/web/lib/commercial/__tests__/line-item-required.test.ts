import { describe, expect, it } from "vitest";
import { createBlankCommercialDocument, createBlankLineItem, hasProductOrService } from "../schema";

describe("hasProductOrService", () => {
  it("rejects a blank draft with only the empty starter row", () => {
    expect(hasProductOrService(createBlankCommercialDocument("invoice"))).toBe(false);
  });

  it("rejects whitespace-only descriptions and no rows", () => {
    expect(hasProductOrService({ lineItems: [{ ...createBlankLineItem(), description: "   " }] })).toBe(false);
    expect(hasProductOrService({ lineItems: [] })).toBe(false);
  });

  it("accepts a named line item", () => {
    expect(hasProductOrService({ lineItems: [createBlankLineItem(), { ...createBlankLineItem(), description: "Design" }] })).toBe(true);
  });

  it("accepts a catalog-linked line item", () => {
    expect(hasProductOrService({ lineItems: [{ ...createBlankLineItem(), catalogItemId: "cat_1" }] })).toBe(true);
  });
});
