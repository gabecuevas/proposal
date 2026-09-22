import { describe, expect, it } from "vitest";
import { resolveCommercialText } from "../variables";
import { toCommercialTemplatePayload, instantiateCommercialFromTemplate } from "../parse";
import { createBlankCommercialDocument, QUANTITY_SCALE } from "../schema";

describe("commercial variables and templates", () => {
  it("resolves screenshot aliases from context", () => {
    const result = resolveCommercialText(
      "[Sender.FullName]\n[Recipient.CompanyName]",
      {
        "sender_full_name": "Ada Lovelace",
        "Company.Name": "Analytical Engines",
      },
    );
    expect(result.text).toContain("Ada Lovelace");
    expect(result.text).toContain("Analytical Engines");
    expect(result.unresolved).toEqual([]);
  });

  it("keeps unresolved tokens and reports them", () => {
    const result = resolveCommercialText("[Sender.Phone]", {});
    expect(result.text).toBe("[Sender.Phone]");
    expect(result.unresolved).toEqual(["Sender.Phone"]);
  });

  it("template reset clears customer-specific fields and refreshes line ids", () => {
    const doc = createBlankCommercialDocument("quote", { documentNumber: "9" });
    doc.poNumber = "PO-1";
    doc.billTo = { text: "Acme Corp" };
    doc.lineItems = [{ id: "keep-me", description: "Widget", quantityScaled: QUANTITY_SCALE, rateMinor: 100 }];
    const template = toCommercialTemplatePayload(doc);
    expect(template.documentNumber).toBe("");
    expect(template.poNumber).toBe("");
    expect(template.billTo.text).toBe("[Recipient.CompanyName]");
    expect(template.lineItems[0]?.id).not.toBe("keep-me");
    expect(template.lineItems[0]?.description).toBe("Widget");

    const draft = instantiateCommercialFromTemplate(template, {
      type: "quote",
      documentNumber: "12",
      issueDate: "2026-09-22",
      sourceTemplateId: "tmpl_1",
    });
    expect(draft.documentNumber).toBe("12");
    expect(draft.sourceTemplateId).toBe("tmpl_1");
    expect(draft.lineItems[0]?.id).not.toBe(template.lineItems[0]?.id);
  });
});
