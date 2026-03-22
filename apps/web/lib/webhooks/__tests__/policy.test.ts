import { describe, expect, test } from "vitest";
import { parseAndValidateAllowedIps } from "../policy";

describe("parseAndValidateAllowedIps", () => {
  test("returns normalized unique list for valid IPs", () => {
    const parsed = parseAndValidateAllowedIps([" 127.0.0.1 ", "127.0.0.1", "2001:db8::1"]);
    expect(parsed).toEqual(["127.0.0.1", "2001:db8::1"]);
  });

  test("returns null when any entry is invalid", () => {
    const parsed = parseAndValidateAllowedIps(["127.0.0.1", "not-an-ip"]);
    expect(parsed).toBeNull();
  });

  test("returns empty list for non-array", () => {
    const parsed = parseAndValidateAllowedIps(undefined);
    expect(parsed).toEqual([]);
  });
});
