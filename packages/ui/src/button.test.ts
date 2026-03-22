import { describe, expect, test } from "vitest";
import { Button } from "./button.js";

describe("button", () => {
  test("exports a component", () => {
    expect(typeof Button).toBe("function");
  });
});
