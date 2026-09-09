import { describe, expect, it } from "vitest";
import {
  assessBackgroundImage,
  backgroundImageRequirements,
  clearPageBackground,
  deletePageBackgrounds,
  duplicatePageBackgrounds,
  hasPageBackground,
  parsePageBackgrounds,
  patchPageBackground,
  renderPageBackgroundsHtml,
} from "../page-backgrounds";

describe("page backgrounds", () => {
  it("parses sparse page entries and ignores junk", () => {
    expect(
      parsePageBackgrounds({
        "0": { color: "#f00", colorOpacity: 80 },
        "1": { imageKey: "workspaces/w/uploads/bg.png", imageFit: "fit", imagePosition: "center" },
        nope: { color: "#000" },
        "x": { color: "#fff" },
      }),
    ).toEqual({
      "0": { color: "#ff0000", colorOpacity: 80 },
      "1": {
        imageKey: "workspaces/w/uploads/bg.png",
        imageFit: "fit",
        imagePosition: "center",
        imageRepeat: false,
        imageOpacity: 100,
      },
    });
  });

  it("patches one page without clobbering another", () => {
    const next = patchPageBackground({ "0": { color: "#dc2626", colorOpacity: 100 } }, 1, {
      color: "#1d4ed8",
    });
    expect(next["0"]?.color).toBe("#dc2626");
    expect(next["1"]).toEqual({ color: "#1d4ed8", colorOpacity: 100 });
  });

  it("drops a page when color and image are cleared", () => {
    const next = clearPageBackground({ "0": { color: "#dc2626", colorOpacity: 100 } }, 0);
    expect(next).toEqual({});
    expect(hasPageBackground({ color: null })).toBe(false);
  });

  it("lists Letter pixel targets at 96, 150, and 300 DPI", () => {
    const req = backgroundImageRequirements("letter");
    expect(req.screenPx).toEqual({ width: 816, height: 1056 });
    expect(req.print150Px).toEqual({ width: 1275, height: 1650 });
    expect(req.print300Px).toEqual({ width: 2550, height: 3300 });
    expect(req.widthIn).toBe(8.5);
    expect(req.heightIn).toBe(11);
  });

  it("rejects unsupported types and oversized files", () => {
    const badType = assessBackgroundImage({
      type: "image/gif",
      bytes: 1000,
      width: 2550,
      height: 3300,
      pageSize: "letter",
    });
    expect(badType.ok).toBe(false);
    expect(badType.errors[0]).toMatch(/PNG, JPEG, or WebP/);

    const tooBig = assessBackgroundImage({
      type: "image/png",
      bytes: 26 * 1024 * 1024,
      width: 2550,
      height: 3300,
      pageSize: "letter",
    });
    expect(tooBig.ok).toBe(false);
    expect(tooBig.errors[0]).toMatch(/25 MB/);
  });

  it("warns when the image is small or the wrong aspect ratio", () => {
    const result = assessBackgroundImage({
      type: "image/jpeg",
      bytes: 12 * 1024 * 1024,
      width: 400,
      height: 400,
      pageSize: "letter",
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/10 MB/);
    expect(result.warnings.join(" ")).toMatch(/816 × 1056/);
    expect(result.warnings.join(" ")).toMatch(/aspect ratio/);
  });

  it("emits print layers behind the page box", () => {
    const html = renderPageBackgroundsHtml(
      {
        attrs: {
          pageSize: "letter",
          pageBackgrounds: {
            "0": { color: "#dc2626", colorOpacity: 100 },
            "1": { imageKey: "workspaces/ws/uploads/bg.png", imageFit: "fill" },
          },
        },
      },
      { assetBaseUrl: "https://app.example.test", assetToken: "tok" },
    );
    expect(html).toContain('data-page="0"');
    expect(html).toContain("background-color:#dc2626");
    expect(html).toContain("top:-48px;left:-48px;width:816px;height:1056px");
    expect(html).toContain("top:912px;left:-48px;width:816px;height:1056px");
    expect(html).toContain(
      "https://app.example.test/api/uploads/workspaces/ws/uploads/bg.png?token=tok",
    );
  });

  it("duplicates a page background and shifts later pages", () => {
    const next = duplicatePageBackgrounds(
      {
        "0": { color: "#dc2626", colorOpacity: 100 },
        "1": { color: "#1d4ed8", colorOpacity: 100 },
      },
      0,
    );
    expect(next["0"]?.color).toBe("#dc2626");
    expect(next["1"]?.color).toBe("#dc2626");
    expect(next["2"]?.color).toBe("#1d4ed8");
  });

  it("deletes a page background and shifts later pages down", () => {
    const next = deletePageBackgrounds(
      {
        "0": { color: "#dc2626", colorOpacity: 100 },
        "1": { color: "#1d4ed8", colorOpacity: 100 },
        "2": { color: "#16a34a", colorOpacity: 100 },
      },
      1,
    );
    expect(next).toEqual({
      "0": { color: "#dc2626", colorOpacity: 100 },
      "1": { color: "#16a34a", colorOpacity: 100 },
    });
  });
});
