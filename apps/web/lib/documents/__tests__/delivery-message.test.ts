import { describe, expect, it } from "vitest";
import { deliveryContext, documentDeliveryEmail, renderDeliveryText } from "../delivery-message";
import { publicDocumentToken, publicDocumentUrl, verifyPublicDocumentToken } from "../public-link";

const link = "https://app.example.com/d/doc_1.sig";

function context() {
  return deliveryContext({
    variables: { Sender: { FullName: "Gabe Cuevas" }, Recipient: { CompanyName: "Acme" } },
    recipient: { name: "Jane Doe", email: "jane@acme.com" },
    link,
    title: "Quote Q-0001",
  });
}

describe("renderDeliveryText", () => {
  it("resolves bracket variables, legacy tokens, and blanks unknown ones", () => {
    const text = renderDeliveryText(
      "Hi [Recipient.FirstName] of [Recipient.CompanyName], {{sender_full_name}} here. [Document.Link] [Nope.Missing]",
      context(),
    );
    expect(text).toBe(`Hi Jane of Acme, Gabe Cuevas here. ${link} `);
  });
});

describe("documentDeliveryEmail", () => {
  it("places the link where [Document.Link] appears", () => {
    const email = documentDeliveryEmail({
      subject: "[Document.Title] for [Recipient.FullName]",
      message: "View it here: [Document.Link]\nThanks",
      context: context(),
      link,
      noun: "Quote",
    });
    expect(email.subject).toBe("Quote Q-0001 for Jane Doe");
    expect(email.text).toBe(`View it here: ${link}\nThanks`);
    expect(email.html).toContain(`<a href="${link}">${link}</a>`);
    expect(email.html).toContain("View Quote");
  });

  it("appends the link when the message omits the variable", () => {
    const email = documentDeliveryEmail({
      subject: "",
      message: "Hello <team>",
      context: context(),
      link,
      noun: "Invoice",
    });
    expect(email.subject).toBe("New invoice");
    expect(email.text).toBe(`Hello <team>\n\n${link}`);
    expect(email.html).toContain("Hello &lt;team&gt;");
  });
});

describe("public document links", () => {
  it("round-trips a signed token and rejects tampering", () => {
    const token = publicDocumentToken("doc_123");
    expect(verifyPublicDocumentToken(token)).toBe("doc_123");
    expect(verifyPublicDocumentToken(token.replace("doc_123", "doc_124"))).toBeNull();
    expect(verifyPublicDocumentToken("doc_123")).toBeNull();
    expect(publicDocumentUrl("doc_123", "https://app.example.com/")).toBe(
      `https://app.example.com/d/${token}`,
    );
  });
});
