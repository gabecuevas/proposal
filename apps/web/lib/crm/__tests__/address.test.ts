import { describe, expect, it } from "vitest";
import { formatAddressDisplay } from "../address";

describe("address helpers", () => {
  it("formats a full address for display", () => {
    expect(
      formatAddressDisplay({
        address_line_1: "123 Main St",
        city: "San Jose",
        state: "CA",
        postal_code: "95112",
      }),
    ).toBe("123 Main St, San Jose, CA, 95112");
  });
});
