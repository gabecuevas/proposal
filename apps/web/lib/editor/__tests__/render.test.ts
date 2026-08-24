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
      type: "fieldCanvas",
      content: [
        {
          type: "signerField",
          attrs: {
            fieldId: "field-1",
            recipientId: "recipient-primary",
            type: "signature",
            required: true,
            label: "",
            placeholder: "",
            defaultValue: "",
            dropdownOptions: "[]",
            xPct: 0.04,
            yPct: 0.04,
            wPct: 0.38,
            hPct: 0.09,
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

    expect(preview).toContain("variable-token");
    expect(preview).toContain("field-1");
    expect(preview).toContain("--field-x:0.04");
    expect(finalized).toContain("Certificate");
  });

  test("renders text boxes, tables, youtube and aligned images", () => {
    const html = renderComputedHtml({
      doc: {
        type: "doc",
        content: [
          {
            type: "textBox",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello box", marks: [{ type: "bold" }] }] }],
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "2" }] }] },
                ],
              },
            ],
          },
          { type: "youtube", attrs: { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
          { type: "image", attrs: { src: "/img.png", alt: "Logo", widthPct: 50, align: "left" } },
        ],
      },
      mode: "sender-preview",
      resolvedVariables: {},
      signerFieldValues: [],
    });

    expect(html).toContain('data-node-type="textBox"');
    expect(html).toContain("<strong>Hello box</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th><p>A</p></th>");
    expect(html).toContain("Watch video:");
    expect(html).toContain('data-align="left"');
    expect(html).toContain("width:50%");
  });
});
