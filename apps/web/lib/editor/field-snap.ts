export type FieldRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type AlignGuide = {
  axis: "x" | "y";
  /** Position in the same coordinate space as the rects (container px). */
  position: number;
};

export type SnapResult = {
  left: number;
  top: number;
  width: number;
  height: number;
  guides: AlignGuide[];
};

export const SNAP_THRESHOLD_PX = 6;

export function rectEdges(rect: FieldRect) {
  return {
    left: rect.left,
    right: rect.left + rect.width,
    top: rect.top,
    bottom: rect.top + rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

function unique(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 10) / 10))];
}

export function collectGuidePositions(
  others: FieldRect[],
  container: { width: number; height: number; margin?: number },
): { xs: number[]; ys: number[] } {
  const xs = [0, container.width / 2, container.width];
  const ys = [0, container.height / 2, container.height];
  const margin = container.margin ?? 0;
  if (margin > 0) {
    xs.push(margin, container.width - margin);
    ys.push(margin, container.height - margin);
  }
  for (const rect of others) {
    const edges = rectEdges(rect);
    xs.push(edges.left, edges.right, edges.centerX);
    ys.push(edges.top, edges.bottom, edges.centerY);
  }
  return { xs: unique(xs), ys: unique(ys) };
}

function nearest(value: number, candidates: number[], threshold: number): { pos: number; delta: number } | null {
  let best: { pos: number; delta: number } | null = null;
  for (const pos of candidates) {
    const delta = pos - value;
    if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
      best = { pos, delta };
    }
  }
  return best;
}

function pickSnap(
  options: Array<{ pos: number; delta: number } | null>,
): { pos: number; delta: number } | null {
  let best: { pos: number; delta: number } | null = null;
  for (const option of options) {
    if (!option) {
      continue;
    }
    if (!best || Math.abs(option.delta) < Math.abs(best.delta)) {
      best = option;
    }
  }
  return best;
}

function clampRect(rect: FieldRect, container: { width: number; height: number }): FieldRect {
  const width = Math.min(container.width, Math.max(8, rect.width));
  const height = Math.min(container.height, Math.max(8, rect.height));
  const left = Math.min(Math.max(0, rect.left), Math.max(0, container.width - width));
  const top = Math.min(Math.max(0, rect.top), Math.max(0, container.height - height));
  return { left, top, width, height };
}

/** Snap a moving field to other fields, page edges, and optional print margins. */
export function snapRect(
  moving: FieldRect,
  others: FieldRect[],
  container: { width: number; height: number; margin?: number },
  threshold = SNAP_THRESHOLD_PX,
): SnapResult {
  const { xs, ys } = collectGuidePositions(others, container);
  const edges = rectEdges(moving);
  const guides: AlignGuide[] = [];

  const xSnap = pickSnap([
    nearest(edges.left, xs, threshold),
    nearest(edges.right, xs, threshold),
    nearest(edges.centerX, xs, threshold),
  ]);
  const ySnap = pickSnap([
    nearest(edges.top, ys, threshold),
    nearest(edges.bottom, ys, threshold),
    nearest(edges.centerY, ys, threshold),
  ]);

  let left = moving.left;
  let top = moving.top;
  if (xSnap) {
    left += xSnap.delta;
    guides.push({ axis: "x", position: xSnap.pos });
  }
  if (ySnap) {
    top += ySnap.delta;
    guides.push({ axis: "y", position: ySnap.pos });
  }

  const next = clampRect({ ...moving, left, top }, container);
  return { ...next, guides };
}

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

/** Resize a rect from a corner while keeping the opposite corner fixed. */
export function applyCornerResize(
  start: FieldRect,
  corner: ResizeCorner,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
): FieldRect {
  let left = start.left;
  let top = start.top;
  let width = start.width;
  let height = start.height;

  if (corner.includes("e")) {
    width = Math.max(minW, start.width + dx);
  }
  if (corner.includes("w")) {
    width = Math.max(minW, start.width - dx);
    left = start.left + start.width - width;
  }
  if (corner.includes("s")) {
    height = Math.max(minH, start.height + dy);
  }
  if (corner.includes("n")) {
    height = Math.max(minH, start.height - dy);
    top = start.top + start.height - height;
  }

  return { left, top, width, height };
}

/** Snap the edges that moved while resizing from a given corner. */
export function snapCornerResize(
  moving: FieldRect,
  corner: ResizeCorner,
  others: FieldRect[],
  container: { width: number; height: number; margin?: number },
  threshold = SNAP_THRESHOLD_PX,
): SnapResult {
  const { xs, ys } = collectGuidePositions(others, container);
  const edges = rectEdges(moving);
  const guides: AlignGuide[] = [];
  let { left, top, width, height } = moving;

  if (corner.includes("e")) {
    const snap = nearest(edges.right, xs, threshold);
    if (snap) {
      width = Math.max(8, snap.pos - left);
      guides.push({ axis: "x", position: snap.pos });
    }
  }
  if (corner.includes("w")) {
    const snap = nearest(edges.left, xs, threshold);
    if (snap) {
      const right = left + width;
      left = snap.pos;
      width = Math.max(8, right - left);
      guides.push({ axis: "x", position: snap.pos });
    }
  }
  if (corner.includes("s")) {
    const snap = nearest(edges.bottom, ys, threshold);
    if (snap) {
      height = Math.max(8, snap.pos - top);
      guides.push({ axis: "y", position: snap.pos });
    }
  }
  if (corner.includes("n")) {
    const snap = nearest(edges.top, ys, threshold);
    if (snap) {
      const bottom = top + height;
      top = snap.pos;
      height = Math.max(8, bottom - top);
      guides.push({ axis: "y", position: snap.pos });
    }
  }

  return { ...clampRect({ left, top, width, height }, container), guides };
}

/** Snap the right/bottom edges while resizing from the corner. */
export function snapResize(
  moving: FieldRect,
  others: FieldRect[],
  container: { width: number; height: number; margin?: number },
  options: { lockHeight?: boolean } = {},
  threshold = SNAP_THRESHOLD_PX,
): SnapResult {
  const { xs, ys } = collectGuidePositions(others, container);
  const edges = rectEdges(moving);
  const guides: AlignGuide[] = [];

  const rightSnap = nearest(edges.right, xs, threshold);
  let width = moving.width;
  if (rightSnap) {
    width = Math.max(8, rightSnap.pos - moving.left);
    guides.push({ axis: "x", position: rightSnap.pos });
  }

  let height = moving.height;
  if (!options.lockHeight) {
    const bottomSnap = nearest(edges.bottom, ys, threshold);
    if (bottomSnap) {
      height = Math.max(8, bottomSnap.pos - moving.top);
      guides.push({ axis: "y", position: bottomSnap.pos });
    }
  }

  const next = clampRect({ ...moving, width, height }, container);
  return { ...next, guides };
}
