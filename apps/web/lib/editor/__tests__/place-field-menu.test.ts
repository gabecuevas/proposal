import { describe, expect, it } from "vitest";
import { placeFieldMenu } from "../place-field-menu";

const viewport = { width: 1280, height: 800 };

describe("placeFieldMenu", () => {
  it("opens downward when there is room below the gear", () => {
    const placed = placeFieldMenu(
      { top: 120, left: 400, right: 424, bottom: 144, width: 24, height: 24 },
      viewport,
      240,
    );
    expect(placed.placement).toBe("down");
    expect(placed.top).toBe(148);
    expect(placed.bottom).toBeUndefined();
    expect(placed.left).toBe(400);
  });

  it("flips upward when the preferred height does not fit below the gear", () => {
    const placed = placeFieldMenu(
      { top: 500, left: 400, right: 424, bottom: 524, width: 24, height: 24 },
      viewport,
      240,
      360,
    );
    expect(placed.placement).toBe("up");
    expect(placed.bottom).toBe(viewport.height - 500 + 4);
  });

  it("flips upward near the bottom of the viewport", () => {
    const placed = placeFieldMenu(
      { top: 720, left: 400, right: 424, bottom: 744, width: 24, height: 24 },
      viewport,
      240,
    );
    expect(placed.placement).toBe("up");
    expect(placed.top).toBeUndefined();
    expect(placed.bottom).toBe(viewport.height - 720 + 4);
    expect(placed.maxHeight).toBeGreaterThanOrEqual(280);
  });

  it("aligns the panel to the right edge of the gear", () => {
    const placed = placeFieldMenu(
      { top: 120, left: 500, right: 524, bottom: 144, width: 24, height: 24 },
      viewport,
      280,
      460,
      "end",
    );
    expect(placed.left).toBe(524 - 280);
  });

  it("keeps the panel inside the right edge", () => {
    const placed = placeFieldMenu(
      { top: 80, left: 1200, right: 1224, bottom: 104, width: 24, height: 24 },
      viewport,
      240,
    );
    expect(placed.left + 240).toBeLessThanOrEqual(viewport.width - 8);
  });
});
