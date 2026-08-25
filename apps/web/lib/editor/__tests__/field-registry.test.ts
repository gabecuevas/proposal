import { describe, expect, it } from "vitest";
import { FIELD_REGISTRY, prismaFieldType } from "../field-registry";

describe("field registry", () => {
  it("lists supported and planned types without duplicating tray ids", () => {
    const ids = FIELD_REGISTRY.map((entry) => entry.id);
    expect(ids).toEqual([
      "signature",
      "initials",
      "text",
      "date",
      "file",
      "radio",
      "checkbox",
      "dropdown",
      "card",
      "stamp",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FIELD_REGISTRY.filter((entry) => entry.editorType).map((entry) => entry.editorType)).toEqual([
      "signature",
      "initial",
      "text",
      "date",
      "checkbox",
      "dropdown",
    ]);
  });

  it("maps dropdown drafts onto Prisma TEXT until the enum exists", () => {
    expect(prismaFieldType("dropdown")).toBe("TEXT");
    expect(prismaFieldType("signature")).toBe("SIGNATURE");
    expect(prismaFieldType("initial")).toBe("INITIALS");
    expect(prismaFieldType("checkbox")).toBe("CHECKBOX");
  });
});
