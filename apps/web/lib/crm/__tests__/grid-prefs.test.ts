import { describe, expect, it } from "vitest";
import { compareGridValues, defaultVisibleIds, mergeGridPrefs } from "../grid-prefs";

const columns = [
  { id: "name", required: true },
  { id: "email" },
  { id: "phone", defaultVisible: false },
  { id: "city", defaultVisible: false },
];

describe("mergeGridPrefs", () => {
  it("uses default visibility when nothing is stored", () => {
    expect(mergeGridPrefs(null, columns).visible).toEqual(["name", "email"]);
  });

  it("keeps required columns even if they were hidden", () => {
    const prefs = mergeGridPrefs({ visible: ["email", "phone"] }, columns);
    expect(prefs.visible).toContain("name");
    expect(prefs.visible).toContain("email");
    expect(prefs.visible).toContain("phone");
  });

  it("drops unknown column ids", () => {
    const prefs = mergeGridPrefs({ visible: ["name", "gone"], widths: { gone: 200, name: 180 } }, columns);
    expect(prefs.visible).toEqual(["name"]);
    expect(prefs.widths).toEqual({ name: 180 });
  });
});

describe("defaultVisibleIds", () => {
  it("includes columns that are not explicitly hidden", () => {
    expect(defaultVisibleIds(columns)).toEqual(["name", "email"]);
  });
});

describe("compareGridValues", () => {
  it("sorts nulls last", () => {
    expect(compareGridValues(null, "A", "asc")).toBe(1);
    expect(compareGridValues("A", null, "asc")).toBe(-1);
  });

  it("compares numbers and strings", () => {
    expect(compareGridValues(2, 10, "asc")).toBeLessThan(0);
    expect(compareGridValues("beta", "alpha", "desc")).toBeLessThan(0);
  });
});
