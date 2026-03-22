import { describe, expect, test } from "vitest";
import { toMinorUnits } from "../checkout";

describe("toMinorUnits", () => {
  test("converts decimal amount to cents", () => {
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(toMinorUnits(10)).toBe(1000);
  });

  test("clamps negative amounts to zero", () => {
    expect(toMinorUnits(-1)).toBe(0);
  });
});
