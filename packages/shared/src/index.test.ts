import { describe, expect, test } from "vitest";
import { workspaceRoleSchema } from "./index.js";

describe("shared schema", () => {
  test("accepts a valid workspace role", () => {
    const parsed = workspaceRoleSchema.parse("OWNER");
    expect(parsed).toBe("OWNER");
  });
});
