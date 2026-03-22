import { describe, expect, test } from "vitest";
import { renderComputedHtml } from "../render";
import type { EditorDoc } from "../types";

const demoDoc: EditorDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "variableToken", attrs: { key: "client.name" } },
      ],
    },
    { type: "quoteTable", attrs: { tableId: "default" } },
    {
      type: "paragraph",
      content: [
        {
          type: "signerField",
          attrs: {
            fieldId: "field-1",
            recipientId: "recipient-primary",
            type: "signature",
            required: true,
          },
        },
      ],
    },
  ],
};

describe("renderComputedHtml", () => {
  test("renders sender preview and finalized variants", () => {
    const preview = renderComputedHtml({
      doc: demoDoc,
      mode: "sender-preview",
      resolvedVariables: { "client.name": "Acme Corp" },
      pricing: {
        currency: "USD",
        items: [
          { id: "1", name: "Setup", quantity: 1, unitPrice: 1000 },
          { id: "2", name: "Support", quantity: 1, unitPrice: 200, recurring: { interval: "month" } },
        ],
        discountPercent: 0,
        taxPercent: 0,
      },
      signerFieldValues: [],
    });

    const finalized = renderComputedHtml({
      doc: demoDoc,
      mode: "finalized",
      resolvedVariables: { "client.name": "Acme Corp" },
      pricing: {
        currency: "USD",
        items: [
          { id: "1", name: "Setup", quantity: 1, unitPrice: 1000 },
          { id: "2", name: "Support", quantity: 1, unitPrice: 200, recurring: { interval: "month" } },
        ],
        discountPercent: 0,
        taxPercent: 0,
      },
      signerFieldValues: [
        {
          fieldId: "field-1",
          recipientId: "recipient-primary",
          type: "signature",
          required: true,
          value: "Signed",
        },
      ],
    });

    expect(preview).toMatchInlineSnapshot(
      `"<article><p>Hello <span class="variable-token" data-variable-key="client.name">Acme Corp</span></p><section class="quote-table" data-node-type="quoteTable"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Cadence</th><th>Status</th><th>Line Total</th></tr></thead><tbody><tr><td>Setup</td><td>1</td><td>USD 1000.00</td><td>One-time</td><td>Included</td><td>USD 1000.00</td></tr><tr><td>Support</td><td>1</td><td>USD 200.00</td><td>Recurring month</td><td>Included</td><td>USD 200.00</td></tr></tbody></table><p>One-time subtotal: USD 1000.00</p><p>Recurring monthly subtotal: USD 200.00</p><p>Recurring yearly subtotal: USD 0.00</p><p>Discount: USD 0.00</p><p>Tax: USD 0.00</p><p>Total due now: USD 1000.00</p></section><p><span class="signer-field" data-field-id="field-1" data-recipient-id="recipient-primary" data-type="signature" data-editable="false">[signature]</span></p></article>"`,
    );
    expect(finalized).toMatchInlineSnapshot(
      `"<article><p>Hello <span class="variable-token" data-variable-key="client.name">Acme Corp</span></p><section class="quote-table" data-node-type="quoteTable"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Cadence</th><th>Status</th><th>Line Total</th></tr></thead><tbody><tr><td>Setup</td><td>1</td><td>USD 1000.00</td><td>One-time</td><td>Included</td><td>USD 1000.00</td></tr><tr><td>Support</td><td>1</td><td>USD 200.00</td><td>Recurring month</td><td>Included</td><td>USD 200.00</td></tr></tbody></table><p>One-time subtotal: USD 1000.00</p><p>Recurring monthly subtotal: USD 200.00</p><p>Recurring yearly subtotal: USD 0.00</p><p>Discount: USD 0.00</p><p>Tax: USD 0.00</p><p>Total due now: USD 1000.00</p></section><p><span class="signer-field-finalized" data-field-id="field-1">Signed</span></p></article><section class="certificate-page"><h2>Certificate</h2><p>Document finalized with immutable audit trail.</p></section>"`,
    );
  });
});
