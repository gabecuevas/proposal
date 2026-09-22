import type { JSONContent } from "@tiptap/core";

export type FlowFixtureId =
  | "short-agreement"
  | "multi-page-breaks"
  | "long-table"
  | "edge-assets"
  | "stress-50-pages";

export type FlowFixture = {
  id: FlowFixtureId;
  title: string;
  description: string;
  /** Expected approximate pages under Letter + PaginationPlus defaults (informational). */
  expectedPagesHint: number;
  doc: JSONContent;
};

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : undefined };
}

function heading(level: 1 | 2 | 3, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function pageBreak(): JSONContent {
  return { type: "pageBreak" };
}

function orderedItem(text: string): JSONContent {
  return {
    type: "listItem",
    content: [paragraph(text)],
  };
}

const SHORT_AGREEMENT: FlowFixture = {
  id: "short-agreement",
  title: "Short business agreement",
  description: "Headings and numbered clauses for basic formatting fidelity.",
  expectedPagesHint: 1,
  doc: {
    type: "doc",
    content: [
      heading(1, "Master Services Agreement"),
      paragraph("This Agreement is entered into as of the Effective Date by and between Provider and Customer."),
      heading(2, "1. Services"),
      {
        type: "orderedList",
        attrs: { start: 1 },
        content: [
          orderedItem("Provider will perform the professional services described in each Statement of Work."),
          orderedItem("Customer will provide timely access to personnel and materials reasonably required."),
          orderedItem("Changes to scope require a written change order signed by both parties."),
        ],
      },
      heading(2, "2. Fees"),
      paragraph("Fees are due within thirty (30) days of invoice unless otherwise stated in a Statement of Work."),
      heading(2, "3. Confidentiality"),
      paragraph(
        "Each party will protect the other party's Confidential Information with at least reasonable care and will not disclose it except as permitted by this Agreement.",
      ),
    ],
  },
};

const MULTI_PAGE_BREAKS: FlowFixture = {
  id: "multi-page-breaks",
  title: "Multi-page with nested lists and manual breaks",
  description: "Exercises explicit pageBreak nodes plus nested list structure.",
  expectedPagesHint: 3,
  doc: {
    type: "doc",
    content: [
      heading(1, "Implementation Playbook"),
      paragraph("Section A — Discovery"),
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              paragraph("Stakeholder interviews"),
              {
                type: "bulletList",
                content: [
                  orderedItem("Executive sponsor"),
                  orderedItem("Day-to-day operators"),
                ],
              },
            ],
          },
          orderedItem("Systems inventory"),
        ],
      },
      pageBreak(),
      heading(1, "Section B — Build"),
      {
        type: "orderedList",
        content: [
          orderedItem("Configure environments"),
          orderedItem("Migrate sample data"),
          orderedItem("Run acceptance checklist"),
        ],
      },
      paragraph("Notes continue after the manual break above."),
      pageBreak(),
      heading(1, "Section C — Launch"),
      paragraph("Training, hypercare, and retrospective."),
    ],
  },
};

function longTableFixture(): FlowFixture {
  const rows: JSONContent[] = [
    {
      type: "tableRow",
      content: ["Item", "Description", "Qty", "Notes"].map((cell) => ({
        type: "tableHeader",
        content: [paragraph(cell)],
      })),
    },
  ];
  for (let i = 1; i <= 40; i += 1) {
    rows.push({
      type: "tableRow",
      content: [
        paragraph(`ROW-${String(i).padStart(3, "0")}`),
        paragraph(`Line item ${i} with enough text to wrap within a narrow column for layout stress.`),
        paragraph(String((i % 7) + 1)),
        paragraph(i % 5 === 0 ? "Oversized note ".repeat(12).trim() : "Standard"),
      ].map((cell) => ({ type: "tableCell", content: [cell] })),
    });
  }
  return {
    id: "long-table",
    title: "Long table spanning pages",
    description: "40-row table intended to cross page boundaries under Letter pagination.",
    expectedPagesHint: 3,
    doc: {
      type: "doc",
      content: [heading(1, "Pricing Schedule"), { type: "table", content: rows }],
    },
  };
}

const EDGE_ASSETS: FlowFixture = {
  id: "edge-assets",
  title: "Long URLs, oversized image, oversized row",
  description: "Edge cases that often clip or overflow in paginated editors.",
  expectedPagesHint: 2,
  doc: {
    type: "doc",
    content: [
      heading(1, "Edge asset checks"),
      paragraph(
        "Long URL: https://example.com/path/to/a/very/long/resource/identifier/that/should/wrap-or-break-without-clipping?query=param1&another=param2&more=true",
      ),
      {
        type: "paragraph",
        content: [
          {
            type: "image",
            attrs: {
              src:
                "data:image/svg+xml;utf8," +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="100%" height="100%" fill="#cbd5e1"/><text x="40" y="200" font-size="48" fill="#0f172a">Oversized inline image (1200×400)</text></svg>`,
                ),
              alt: "Oversized synthetic image",
            },
          },
        ],
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [
                  paragraph(
                    "Oversized table cell content. ".repeat(80).trim(),
                  ),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

function stress50Pages(): FlowFixture {
  const content: JSONContent[] = [heading(1, "50-page stress fixture")];
  for (let page = 1; page <= 50; page += 1) {
    content.push(heading(2, `Section ${page}`));
    for (let para = 1; para <= 6; para += 1) {
      content.push(
        paragraph(
          `Stress paragraph ${page}.${para}: The quick brown fox jumps over the lazy dog. ` +
            `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.`,
        ),
      );
    }
    if (page < 50 && page % 5 === 0) {
      content.push(pageBreak());
    }
  }
  return {
    id: "stress-50-pages",
    title: "50-page stress document",
    description: "Large continuous document for responsiveness measurement (synthetic).",
    expectedPagesHint: 50,
    doc: { type: "doc", content },
  };
}

export const FLOW_FIXTURES: Record<FlowFixtureId, FlowFixture> = {
  "short-agreement": SHORT_AGREEMENT,
  "multi-page-breaks": MULTI_PAGE_BREAKS,
  "long-table": longTableFixture(),
  "edge-assets": EDGE_ASSETS,
  "stress-50-pages": stress50Pages(),
};

export const FLOW_FIXTURE_LIST = Object.values(FLOW_FIXTURES);
