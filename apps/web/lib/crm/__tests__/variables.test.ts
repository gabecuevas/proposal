import { describe, expect, it } from "vitest";
import {
  contactRecordToVariableContext,
  crmToDocumentVariables,
  mergeCrmVariablesIntoContext,
} from "../variables";

describe("crmToDocumentVariables", () => {
  it("maps person and company fields onto Recipient, Client, and Company tokens", () => {
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
    expect(values.Recipient?.FirstName).toBe("Ada");
    expect(values.Recipient?.Email).toBe("ada@example.com");
    expect(values.Recipient?.CompanyName).toBe("Analytical Engines");
    expect(values.Recipient?.Title).toBe("Analyst");
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
    expect(values.Recipient?.CompanyName).toBe("Solo LLC");
  });
});

describe("contactRecordToVariableContext", () => {
  it("includes Recipient tokens and a legacy contact blob", () => {
    const values = contactRecordToVariableContext({
      id: "c1",
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      company_name: "Solo LLC",
      city: "London",
    });
    expect(values.Recipient).toMatchObject({
      FirstName: "Ada",
      FullName: "Ada Lovelace",
      CompanyName: "Solo LLC",
    });
    expect(values.contact).toMatchObject({
      id: "c1",
      email: "ada@example.com",
      company_name: "Solo LLC",
    });
  });
});

describe("mergeCrmVariablesIntoContext", () => {
  it("merges CRM namespaces without wiping document metadata", () => {
    const merged = mergeCrmVariablesIntoContext(
      {
        document_kind: "proposal",
        editor_layout: "flow",
        Recipient: { FirstName: "Old", CustomNote: "keep" },
        Custom: { Foo: "bar" },
      },
      contactRecordToVariableContext({
        id: "c2",
        first_name: "New",
        last_name: "Person",
        full_name: "New Person",
        email: "new@example.com",
        company_name: "Acme",
      }),
    );
    expect(merged.document_kind).toBe("proposal");
    expect(merged.editor_layout).toBe("flow");
    expect(merged.Custom).toEqual({ Foo: "bar" });
    expect(merged.Recipient).toMatchObject({
      FirstName: "New",
      LastName: "Person",
      CustomNote: "keep",
      CompanyName: "Acme",
    });
    expect(merged.Client).toMatchObject({ FirstName: "New" });
    expect(merged.Company).toMatchObject({ Name: "Acme" });
  });
});
