import { describe, expect, it } from "vitest";
import { snapRect, snapResize, collectGuidePositions, applyCornerResize } from "../field-snap";

describe("field snap", () => {
  const page = { width: 816, height: 1056, margin: 48 };

  it("snaps a field to another field's left edge", () => {
    const result = snapRect(
      { left: 102, top: 80, width: 200, height: 40 },
      [{ left: 100, top: 200, width: 180, height: 40 }],
      page,
      6,
    );
    expect(result.left).toBe(100);
    expect(result.guides.some((guide) => guide.axis === "x" && guide.position === 100)).toBe(true);
  });

  it("snaps to the page center", () => {
    const result = snapRect({ left: 405, top: 10, width: 10, height: 10 }, [], page, 6);
    expect(result.left).toBe(403);
    expect(result.guides.some((guide) => guide.axis === "x" && guide.position === 408)).toBe(true);
  });

  it("does not change height when width is locked", () => {
    const result = snapResize(
      { left: 40, top: 40, width: 158, height: 36 },
      [{ left: 200, top: 80, width: 100, height: 40 }],
      page,
      { lockHeight: true },
      6,
    );
    expect(result.width).toBe(160);
    expect(result.height).toBe(36);
    expect(result.guides.every((guide) => guide.axis === "x")).toBe(true);
  });

  it("resizes from the north-west corner without moving the opposite corner", () => {
    const next = applyCornerResize({ left: 100, top: 80, width: 200, height: 40 }, "nw", -10, -8, 20, 16);
    expect(next).toEqual({ left: 90, top: 72, width: 210, height: 48 });
  });

  it("keeps the minimum size when dragging a corner inward", () => {
    const next = applyCornerResize({ left: 100, top: 80, width: 40, height: 30 }, "se", -100, -100, 24, 16);
    expect(next.width).toBe(24);
    expect(next.height).toBe(16);
    expect(next.left).toBe(100);
    expect(next.top).toBe(80);
  });

  it("includes print margins in guide positions", () => {
    const { xs, ys } = collectGuidePositions([], page);
    expect(xs).toContain(48);
    expect(xs).toContain(768);
    expect(ys).toContain(48);
  });
});
