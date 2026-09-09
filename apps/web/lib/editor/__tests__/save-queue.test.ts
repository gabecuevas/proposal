import { describe, expect, it } from "vitest";
import { SaveQueue } from "../save-queue";

describe("SaveQueue", () => {
  it("runs a single task", async () => {
    const queue = new SaveQueue();
    const calls: number[] = [];
    await queue.run(async () => {
      calls.push(1);
    });
    expect(calls).toEqual([1]);
  });

  it("drops a save that has not started when a newer one is queued", async () => {
    const queue = new SaveQueue();
    const calls: string[] = [];
    const first = queue.run(async () => {
      calls.push("first");
    });
    const latest = queue.run(async () => {
      calls.push("latest");
    });
    await Promise.all([first, latest]);
    expect(calls).toEqual(["latest"]);
  });

  it("finishes an in-flight save, then runs only the latest queued payload", async () => {
    const queue = new SaveQueue();
    const calls: string[] = [];
    let started!: () => void;
    const startedGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = queue.run(async () => {
      calls.push("first-start");
      started();
      await hold;
      calls.push("first-end");
    });
    await startedGate;

    void queue.run(async () => {
      calls.push("stale");
    });
    const latest = queue.run(async () => {
      calls.push("latest");
    });

    release();
    await Promise.all([first, latest]);
    expect(calls).toEqual(["first-start", "first-end", "latest"]);
  });
});
