import { describe, expect, it } from "vitest";
import { DEFAULT_FLOW_TABLE_OPTIONS } from "../table-extensions";

describe("flow table options defaults", () => {
  it("matches Docs-like starting values", () => {
    expect(DEFAULT_FLOW_TABLE_OPTIONS.cellPaddingInches).toBe(0.05);
    expect(DEFAULT_FLOW_TABLE_OPTIONS.verticalAlign).toBe("top");
    expect(DEFAULT_FLOW_TABLE_OPTIONS.borderWidthPt).toBe(0);
    expect(DEFAULT_FLOW_TABLE_OPTIONS.tableAlign).toBe("left");
  });
});
