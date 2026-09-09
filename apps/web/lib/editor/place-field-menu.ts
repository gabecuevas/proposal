export type MenuAnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type PlacedFieldMenu = {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
  placement: "up" | "down";
};

export const FIELD_OPTIONS_MENU_WIDTH = 280;
export const FIELD_OPTIONS_MENU_HEIGHT = 460;
export const FIELD_OPTIONS_MENU_MIN_HEIGHT = 280;

const PAD = 8;

/**
 * Place a field settings popover next to its gear. Flip upward when the
 * remaining space below the anchor is tighter than the space above.
 */
export function placeFieldMenu(
  anchor: MenuAnchorRect,
  viewport: ViewportSize,
  menuWidth: number,
  preferredHeight = FIELD_OPTIONS_MENU_HEIGHT,
  align: "start" | "end" = "start",
): PlacedFieldMenu {
  const spaceBelow = viewport.height - anchor.bottom - PAD;
  const spaceAbove = anchor.top - PAD;
  const placement: "up" | "down" =
    spaceBelow < preferredHeight && spaceAbove > spaceBelow ? "up" : "down";
  const available = placement === "up" ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(FIELD_OPTIONS_MENU_MIN_HEIGHT, Math.min(preferredHeight, available));

  let left = align === "end" ? anchor.right - menuWidth : anchor.left;
  if (left + menuWidth > viewport.width - PAD) {
    left = viewport.width - menuWidth - PAD;
  }
  left = Math.max(PAD, left);

  if (placement === "up") {
    return {
      bottom: viewport.height - anchor.top + 4,
      left,
      maxHeight,
      placement,
    };
  }

  return { top: anchor.bottom + 4, left, maxHeight, placement };
}
