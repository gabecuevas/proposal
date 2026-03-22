import { describe, expect, test } from "vitest";
import { applySignerFieldValue } from "../signer-fields";

describe("applySignerFieldValue", () => {
  test("allows only assigned signer recipient", () => {
    const next = applySignerFieldValue(
      [],
      { recipientId: "r1", role: "signer" },
      {
        fieldId: "f1",
        recipientId: "r1",
        required: true,
        type: "signature",
        value: "signed",
      },
    );

    expect(next).toHaveLength(1);

    expect(() =>
      applySignerFieldValue(next, { recipientId: "r2", role: "viewer" }, {
        fieldId: "f2",
        recipientId: "r1",
        required: true,
        type: "text",
        value: "nope",
      }),
    ).toThrowError("Recipient is not allowed to fill this field");
  });
});
