import { describe, expect, it } from "vitest";
import { crmToDocumentVariables } from "../variables";

describe("crmToDocumentVariables", () => {
  it("maps person and company fields onto Client and Company tokens", () => {
    const values = crmToDocumentVariables(
      {
        first_name: "Ada",
        last_name: "Lovelace",
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "555-0100",
        title: "Analyst",
        city: "London",
        company_name: "Fallback Co",
      },
      {
        name: "Analytical Engines",
        website: "https://engines.example",
        industry: "Computing",
        city: "London",
        address_line_1: "12 Prime St",
        country: "UK",
      },
    );
    expect(values.Client?.FirstName).toBe("Ada");
    expect(values.Company?.Name).toBe("Analytical Engines");
    expect(values.Client?.Company).toBe("Analytical Engines");
    expect(values.Company?.Website).toBe("https://engines.example");
    expect(values.Company?.Address).toContain("12 Prime St");
  });

  it("falls back to the person's company name when no company record is linked", () => {
    const values = crmToDocumentVariables({ first_name: "Ada", company_name: "Solo LLC" });
    expect(values.Company?.Name).toBe("Solo LLC");
    expect(values.Client?.Company).toBe("Solo LLC");
  });
});
