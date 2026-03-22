import { describe, expect, test } from "vitest";
import { QUEUE_NAME } from "./index.js";

describe("worker bootstrap", () => {
  test("queue name is stable for producers/consumers", () => {
    expect(QUEUE_NAME).toBe("background-jobs");
  });
});
