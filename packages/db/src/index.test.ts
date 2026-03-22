import { describe, expect, test } from "vitest";

describe("db package", () => {
  test("runs in a node test environment", () => {
    expect(typeof process.version).toBe("string");
  });
});
