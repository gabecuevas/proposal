import type { EditorDoc } from "../../types";

const LONG_PARAGRAPH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ".repeat(
    24,
  );

/**
 * Multi-page proposal used by pagination and PDF-parity tests. Layout is
 * measured in tests via `flowBreakPositions`, not character counts.
 */
export function paginationTortureDoc(): EditorDoc {
  return {
    type: "doc",
    attrs: { pageSize: "letter" },
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Multi-page proposal" }] },
      { type: "paragraph", content: [{ type: "text", text: LONG_PARAGRAPH }] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading near a page boundary" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Outer item" }] },
              {
                type: "orderedList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested 1" }] }] },
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested 2" }] }] },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "image",
        attrs: { src: "/img.png", assetKey: "workspaces/ws/uploads/hero.png", widthPct: 100, align: "center", alt: "Hero" },
      },
      {
        type: "image",
        attrs: { src: "/narrow.png", widthPct: 40, align: "left", alt: "Narrow" },
      },
      { type: "pageBreak" },
      {
        type: "textBox",
        content: [{ type: "paragraph", content: [{ type: "text", text: LONG_PARAGRAPH.slice(0, 800) }] }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Prepared for " },
          { type: "variableToken", attrs: { key: "client.name" } },
        ],
      },
      { type: "quoteTable", attrs: { tableId: "default" } },
      {
        type: "table",
        content: Array.from({ length: 12 }, (_, row) => ({
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: `R${row}C1` }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: `R${row}C2` }] }] },
          ],
        })),
      },
      { type: "pageBreak" },
      { type: "paragraph", content: [{ type: "text", text: "Page three body." }] },
      { type: "paragraph", content: [{ type: "text", text: "Page three continued." }] },
      {
        type: "fieldOverlay",
        content: [
          {
            type: "signerField",
            attrs: {
              fieldId: "sig-edge",
              recipientId: "r1",
              type: "signature",
              required: true,
              xPct: 0.04,
              yPct: 0.92,
              wPct: 0.4,
              hPct: 0.07,
              page: 0,
            },
          },
          {
            type: "signerField",
            attrs: {
              fieldId: "date-p2",
              recipientId: "r1",
              type: "date",
              required: true,
              xPct: 0.55,
              yPct: 0.06,
              wPct: 0.3,
              hPct: 0.05,
              page: 2,
            },
          },
        ],
      },
    ],
  };
}
