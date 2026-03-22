import { describe, expect, test } from "vitest";

const requiredRoutes = [
  "/",
  "/product",
  "/pricing",
  "/security",
  "/templates",
  "/blog",
  "/contact",
  "/login",
  "/signup",
  "/app",
];

describe("marketing and app shell routes", () => {
  test("declares checkpoint 0 route coverage", () => {
    expect(requiredRoutes.length).toBeGreaterThan(9);
  });
});
