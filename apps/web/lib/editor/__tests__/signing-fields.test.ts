import { describe, expect, it } from "vitest";
import {
  extractSigningFields,
  isCheckboxField,
  isDropdownField,
  parseSignerFieldAttrs,
  summarizeSigningFields,
} from "../signer-field-attrs";
import type { EditorDoc } from "../types";

const doc: EditorDoc = {
  type: "doc",
  content: [
    {
      type: "fieldOverlay",
      content: [
        {
          type: "signerField",
          attrs: {
            fieldId: "sig-1",
            recipientId: "r1",
            type: "signature",
            required: true,
            xPct: 0.1,
            yPct: 0.2,
            wPct: 0.3,
            hPct: 0.08,
            page: 1,
          },
        },
        {
          type: "signerField",
          attrs: {
            fieldId: "dd-1",
            recipientId: "r1",
            type: "dropdown",
            dropdownOptions: '["Yes","No"]',
          },
        },
        {
          type: "signerField",
          attrs: {
            fieldId: "cb-1",
            recipientId: "r2",
            type: "checkbox",
          },
        },
        {
          type: "signerField",
          attrs: {
            fieldId: "sender-text",
            recipientId: "sender-self",
            type: "text",
          },
        },
      ],
    },
  ],
};

describe("extractSigningFields", () => {
  it("reads overlay fields with recipient ids and page-relative coordinates", () => {
    const fields = extractSigningFields(doc);
    expect(fields).toHaveLength(4);
    expect(fields[0]?.fieldId).toBe("sig-1");
    expect(fields[0]?.recipientId).toBe("r1");
    expect(fields[0]?.page).toBe(1);
    expect(fields[0]?.xPct).toBe(0.1);
    expect(isDropdownField(fields[1]!)).toBe(true);
    expect(isCheckboxField(fields[2]!)).toBe(true);
    expect(fields[2]?.recipientId).toBe("r2");
  });
});

describe("summarizeSigningFields", () => {
  it("tracks total fields for Sender vs Recipients", () => {
    const summary = summarizeSigningFields(extractSigningFields(doc));
    expect(summary.total).toBe(4);
    expect(summary.sender).toBe(1);
    expect(summary.recipients).toBe(3);
    expect(summary.required).toBe(4);
    expect(summary.byRecipient).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipientId: "sender-self", count: 1 }),
        expect.objectContaining({ recipientId: "r1", count: 2 }),
        expect.objectContaining({ recipientId: "r2", count: 1 }),
      ]),
    );
  });
});

describe("signer field defaults", () => {
  it("gives text fields a single-line size and placeholder", () => {
    const field = parseSignerFieldAttrs({ type: "text" }, 0);
    expect(field.placeholder).toBe("Enter text...");
    expect(field.wPct).toBe(0.14);
    expect(field.hPct).toBe(0.022);
    expect(field.multiline).toBe(false);
    expect(field.validation).toBe("none");
  });

  it("preserves merge field and validation on existing attrs", () => {
    const field = parseSignerFieldAttrs(
      { type: "text", placeholder: "Email", validation: "email", mergeField: "contact.email", multiline: true },
      0,
    );
    expect(field.placeholder).toBe("Email");
    expect(field.validation).toBe("email");
    expect(field.mergeField).toBe("contact.email");
    expect(field.multiline).toBe(true);
  });

  it("compacts missing single-line height to the tight default", () => {
    const field = parseSignerFieldAttrs({ type: "text", multiline: false }, 0);
    expect(field.hPct).toBe(0.022);
  });

  it("keeps a taller text field height after auto-expand", () => {
    const field = parseSignerFieldAttrs({ type: "text", hPct: 0.06, multiline: false }, 0);
    expect(field.hPct).toBeCloseTo(0.06);
  });
});
