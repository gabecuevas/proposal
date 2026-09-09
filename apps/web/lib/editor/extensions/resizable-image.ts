import Image from "@tiptap/extension-image";

export type ImageAlign = "left" | "center" | "right";

export const IMAGE_MIN_WIDTH_PCT = 10;
export const IMAGE_MAX_WIDTH_PCT = 100;

export function parseImageAlign(value: unknown): ImageAlign {
  return value === "left" || value === "right" ? value : "center";
}

export function clampImageWidth(value: unknown): number {
  const width = Number(value);
  if (!Number.isFinite(width)) {
    return IMAGE_MAX_WIDTH_PCT;
  }
  return Math.min(IMAGE_MAX_WIDTH_PCT, Math.max(IMAGE_MIN_WIDTH_PCT, Math.round(width)));
}

/**
 * Image with a stored width and alignment so the editor, the HTML preview and
 * the exported PDF all lay the image out identically. Width is a percentage of
 * the text column rather than pixels, because the paper width is fixed but the
 * on-screen zoom is not.
 */
export const ResizableImage = Image.extend({
  name: "image",
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      widthPct: {
        default: IMAGE_MAX_WIDTH_PCT,
        parseHTML: (element) => clampImageWidth(element.getAttribute("data-width-pct")),
        renderHTML: (attributes) => ({
          "data-width-pct": String(clampImageWidth(attributes.widthPct)),
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => parseImageAlign(element.getAttribute("data-align")),
        renderHTML: (attributes) => ({ "data-align": parseImageAlign(attributes.align) }),
      },
      /**
       * Object store key for images we host. Kept alongside `src` so the
       * detached PDF renderer can rebuild an absolute, tokenized URL.
       */
      assetKey: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-asset-key") ?? "",
        renderHTML: (attributes) =>
          attributes.assetKey ? { "data-asset-key": String(attributes.assetKey) } : {},
      },
    };
  },
});
