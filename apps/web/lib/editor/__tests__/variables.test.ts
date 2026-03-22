import { describe, expect, test } from "vitest";
import { resolveTemplateVariables } from "../variables";

describe("resolveTemplateVariables", () => {
  test("returns missing required variables", () => {
    const output = resolveTemplateVariables(
      {
        "client.name": { required: true },
        "client.company": { required: true },
        "deal.value": { required: false },
      },
      {
        client: { name: "Avery" },
      },
    );

    expect(output.resolved["client.name"]).toBe("Avery");
    expect(output.missing).toEqual(["client.company"]);
  });
});
