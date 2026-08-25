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

  test("renders highlight, alignment, line height, and indent", () => {
    const html = renderComputedHtml({
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "center", lineHeight: "1.5", indent: 2 },
            content: [
              {
                type: "text",
                text: "Noted",
                marks: [{ type: "highlight", attrs: { color: "#fef08a" } }],
              },
            ],
          },
        ],
      },
      mode: "sender-preview",
      resolvedVariables: {},
      signerFieldValues: [],
    });
    expect(html).toContain('style="text-align:center;line-height:1.5;padding-left:48px"');
    expect(html).toContain("<mark style=\"background-color:#fef08a\">Noted</mark>");
  });

  test("prefers durable assetKey URLs over session src", () => {
    const html = renderComputedHtml({
      doc: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              src: "blob:https://example.test/expired",
              assetKey: "workspaces/ws/uploads/hero.png",
              widthPct: 80,
              align: "center",
              alt: "Hero",
            },
          },
          { type: "contentBlockEmbed", attrs: { blockId: "blk_1", version: 3 } },
        ],
      },
      mode: "sender-preview",
      resolvedVariables: {},
      signerFieldValues: [],
      assetBaseUrl: "https://app.example.test",
      assetToken: "tok_abc",
    });
    expect(html).toContain("https://app.example.test/api/uploads/workspaces/ws/uploads/hero.png?token=tok_abc");
    expect(html).not.toContain("blob:");
    expect(html).toContain("Saved library content (id blk_1, v3)");
  });

  test("renders pinned content-library snapshot content", () => {
    const html = renderComputedHtml({
      doc: {
        type: "doc",
        content: [
          {
            type: "contentBlockEmbed",
            attrs: {
              blockId: "blk_1",
              version: 1,
              snapshotDoc: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Library Version A" }] }],
              },
            },
          },
        ],
      },
      mode: "finalized",
      resolvedVariables: {},
      signerFieldValues: [],
    });
    expect(html).toContain("Library Version A");
    expect(html).toContain('data-pinned="true"');
    expect(html).not.toContain("is not inlined");
  });

  test("renders color, font, strike, underline, lists, page breaks, and quote totals from pricing_json", () => {
    const html = renderComputedHtml({
      doc: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Scope" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Styled",
                marks: [
                  { type: "underline" },
                  { type: "strike" },
                  { type: "textStyle", attrs: { color: "#1d4ed8", fontSize: "18px", fontFamily: "Georgia" } },
                ],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] },
            ],
          },
          { type: "pageBreak" },
          { type: "quoteTable", attrs: { tableId: "default" } },
        ],
      },
      mode: "sender-preview",
      resolvedVariables: {},
      pricing: {
        currency: "USD",
        discountPercent: 10,
        taxPercent: 5,
        items: [{ id: "1", name: "Setup", quantity: 2, unitPrice: 100 }],
      },
      signerFieldValues: [],
    });
    expect(html).toContain("<h2>");
    expect(html).toContain("<u>");
    expect(html).toContain("<s>");
    expect(html).toContain("color:#1d4ed8");
    expect(html).toContain("font-size:18px");
    expect(html).toContain("font-family:Georgia");
    expect(html).toContain("<ul>");
    expect(html).toContain('data-node-type="pageBreak"');
    expect(html).toContain("Setup");
    expect(html).toContain("USD 200.00");
    expect(html).toContain("USD 20.00");
    expect(html).toContain("USD 9.00");
    expect(html).toContain("USD 189.00");
  });
});
