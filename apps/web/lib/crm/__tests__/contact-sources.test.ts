import { describe, expect, it } from "vitest";
import { contactSourceLabel, contactSourceOptions } from "../contact-sources";

describe("contactSourceOptions", () => {
  it("includes the default sources used in Settings later", () => {
    const values = contactSourceOptions().map((item) => item.value);
    expect(values).toContain("referral");
    expect(values).toContain("website");
  });

  it("keeps an unknown saved source so existing records still display", () => {
    const options = contactSourceOptions("Trade show");
    expect(options.some((item) => item.value === "Trade show")).toBe(true);
  });

  it("maps known values to labels", () => {
    expect(contactSourceLabel("cold_call")).toBe("Cold call");
    expect(contactSourceLabel("custom")).toBe("custom");
  });
});
