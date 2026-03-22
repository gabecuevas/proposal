import { describe, expect, test } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  test("allows requests up to limit and rejects overflow", () => {
    const key = `rate-limit-test:${crypto.randomUUID()}`;
    const now = 1000;

    const first = checkRateLimit({ key, limit: 2, windowMs: 60_000, now });
    const second = checkRateLimit({ key, limit: 2, windowMs: 60_000, now: now + 1 });
    const third = checkRateLimit({ key, limit: 2, windowMs: 60_000, now: now + 2 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  test("resets counters after window expires", () => {
    const key = `rate-limit-reset-test:${crypto.randomUUID()}`;
    const start = 2000;

    checkRateLimit({ key, limit: 1, windowMs: 5000, now: start });
    const blocked = checkRateLimit({ key, limit: 1, windowMs: 5000, now: start + 100 });
    const reset = checkRateLimit({ key, limit: 1, windowMs: 5000, now: start + 5001 });

    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
  });
});
