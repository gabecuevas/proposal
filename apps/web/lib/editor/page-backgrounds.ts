import { assetUrl } from "@/lib/storage/asset-url";
import {
  pageSizeFromDoc,
  pageSizeSpec,
  type PageSizeId,
} from "./page-geometry";

export const BACKGROUND_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const BACKGROUND_IMAGE_EXTENSIONS = ".png,.jpg,.jpeg,.webp";
/** Soft cap shown in the import modal. The upload API still allows 25MB. */
export const BACKGROUND_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const BACKGROUND_IMAGE_HARD_MAX_BYTES = 25 * 1024 * 1024;

export const PAGE_BACKGROUND_FITS: { id: PageBackgroundFit; label: string }[] = [
  { id: "fill", label: "Fill page" },
  { id: "fit", label: "Fit page" },
  { id: "stretch", label: "Stretch" },
];

export const PAGE_BACKGROUND_POSITIONS: { id: PageBackgroundPosition; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "center-left", label: "Center left" },
  { id: "center", label: "Center" },
  { id: "center-right", label: "Center right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];
const ASPECT_TOLERANCE = 0.08;

export type PageBackgroundFit = "fill" | "fit" | "stretch";
export type PageBackgroundPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PageBackground = {
  color?: string | null;
  colorOpacity?: number;
  imageKey?: string | null;
  imageFit?: PageBackgroundFit;
  imagePosition?: PageBackgroundPosition;
  imageRepeat?: boolean;
  imageOpacity?: number;
};

export type PageBackgrounds = Record<string, PageBackground>;

export type BackgroundImageRequirements = {
  pageSize: PageSizeId;
  pageLabel: string;
  widthIn: number;
  heightIn: number;
  screenPx: { width: number; height: number };
  print150Px: { width: number; height: number };
  print300Px: { width: number; height: number };
  maxBytes: number;
  hardMaxBytes: number;
  typesLabel: string;
};

const FITS = new Set<PageBackgroundFit>(["fill", "fit", "stretch"]);
const POSITIONS = new Set<PageBackgroundPosition>([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export function parsePageBackgrounds(value: unknown): PageBackgrounds {
  const raw = typeof value === "string" ? parseJsonObject(value) : value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const next: PageBackgrounds = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d+$/.test(key)) {
      continue;
    }
    const parsed = parsePageBackground(entry);
    if (parsed) {
      next[key] = parsed;
    }
  }
  return next;
}

export function stringifyPageBackgrounds(value: unknown): string {
  return JSON.stringify(parsePageBackgrounds(value));
}

export function pageBackgroundsFromDoc(doc: { attrs?: Record<string, unknown> } | null | undefined): PageBackgrounds {
  return parsePageBackgrounds(doc?.attrs?.pageBackgrounds);
}

export function backgroundForPage(all: PageBackgrounds, pageIndex: number): PageBackground {
  return all[String(Math.max(0, Math.trunc(pageIndex)))] ?? {};
}

export function hasPageBackground(background: PageBackground | null | undefined): boolean {
  if (!background) {
    return false;
  }
  return Boolean(parseHexColor(background.color) || (background.imageKey && String(background.imageKey).trim()));
}

export function patchPageBackground(
  all: PageBackgrounds,
  pageIndex: number,
  patch: Partial<PageBackground>,
): PageBackgrounds {
  const key = String(Math.max(0, Math.trunc(pageIndex)));
  const nextEntry = compactPageBackground({
    ...backgroundForPage(all, pageIndex),
    ...patch,
  });
  const next: PageBackgrounds = { ...all };
  if (nextEntry) {
    next[key] = nextEntry;
  } else {
    delete next[key];
  }
  return next;
}

export function clearPageBackground(all: PageBackgrounds, pageIndex: number): PageBackgrounds {
  return patchPageBackground(all, pageIndex, { color: null, imageKey: null });
}

/** Copy page `i`'s background onto the new page `i + 1` and shift later pages up. */
export function duplicatePageBackgrounds(all: PageBackgrounds, pageIndex: number): PageBackgrounds {
  const i = Math.max(0, Math.trunc(pageIndex));
  const next: PageBackgrounds = {};
  for (const [key, value] of Object.entries(all)) {
    const n = Number(key);
    if (n > i) {
      next[String(n + 1)] = value;
    } else {
      next[key] = value;
    }
  }
  const source = all[String(i)];
  if (source) {
    next[String(i + 1)] = { ...source };
  }
  return next;
}

/** Drop page `i`'s background and shift later pages down. */
export function deletePageBackgrounds(all: PageBackgrounds, pageIndex: number): PageBackgrounds {
  const i = Math.max(0, Math.trunc(pageIndex));
  const next: PageBackgrounds = {};
  for (const [key, value] of Object.entries(all)) {
    const n = Number(key);
    if (n === i) {
      continue;
    }
    if (n > i) {
      next[String(n - 1)] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function backgroundImageRequirements(pageSize: PageSizeId | unknown): BackgroundImageRequirements {
  const spec = pageSizeSpec(pageSize);
  const widthIn = spec.widthPx / 96;
  const heightIn = spec.heightPx / 96;
  return {
    pageSize: spec.id,
    pageLabel: spec.label,
    widthIn,
    heightIn,
    screenPx: { width: spec.widthPx, height: spec.heightPx },
    print150Px: { width: Math.round(widthIn * 150), height: Math.round(heightIn * 150) },
    print300Px: { width: Math.round(widthIn * 300), height: Math.round(heightIn * 300) },
    maxBytes: BACKGROUND_IMAGE_MAX_BYTES,
    hardMaxBytes: BACKGROUND_IMAGE_HARD_MAX_BYTES,
    typesLabel: "PNG, JPEG, or WebP",
  };
}

export type BackgroundImageAssessment = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function assessBackgroundImage(input: {
  type: string;
  bytes: number;
  width: number;
  height: number;
  pageSize: PageSizeId | unknown;
}): BackgroundImageAssessment {
  const req = backgroundImageRequirements(input.pageSize);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!BACKGROUND_IMAGE_TYPES.includes(input.type as (typeof BACKGROUND_IMAGE_TYPES)[number])) {
    errors.push(`Use a ${req.typesLabel} file.`);
  }
  if (input.bytes > req.hardMaxBytes) {
    errors.push(`File is over the ${formatMb(req.hardMaxBytes)} MB upload limit.`);
  } else if (input.bytes > req.maxBytes) {
    warnings.push(`Files over ${formatMb(req.maxBytes)} MB can slow editing and print. ${formatMb(req.maxBytes)} MB or less is best.`);
  }
  if (input.width < req.screenPx.width || input.height < req.screenPx.height) {
    warnings.push(
      `Image is smaller than ${req.screenPx.width} × ${req.screenPx.height} px and may look soft on screen or in print.`,
    );
  }
  const pageAspect = req.screenPx.width / req.screenPx.height;
  const imageAspect = input.width > 0 && input.height > 0 ? input.width / input.height : 0;
  if (imageAspect > 0 && Math.abs(imageAspect - pageAspect) / pageAspect > ASPECT_TOLERANCE) {
    warnings.push(
      `This image’s aspect ratio does not match ${formatInches(req.widthIn)} × ${formatInches(req.heightIn)} in. “Fill page” will crop the edges.`,
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function pageBackgroundLayerStyles(
  background: PageBackground,
  imageUrl: string | null,
): {
  color?: { backgroundColor: string; opacity: number };
  image?: {
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
    backgroundRepeat: string;
    opacity: number;
  };
} {
  const color = parseHexColor(background.color);
  return {
    color: color
      ? { backgroundColor: color, opacity: clampOpacity(background.colorOpacity) / 100 }
      : undefined,
    image: imageUrl
      ? {
          backgroundImage: `url(${JSON.stringify(imageUrl)})`,
          backgroundSize: fitToCss(background.imageFit),
          backgroundPosition: positionToCss(background.imagePosition),
          backgroundRepeat: background.imageRepeat ? "repeat" : "no-repeat",
          opacity: clampOpacity(background.imageOpacity) / 100,
        }
      : undefined,
  };
}

export function renderPageBackgroundsHtml(
  doc: { attrs?: Record<string, unknown> } | null | undefined,
  options?: { assetBaseUrl?: string; assetToken?: string },
): string {
  const spec = pageSizeSpec(pageSizeFromDoc(doc));
  const all = pageBackgroundsFromDoc(doc);
  const layers: string[] = [];
  const contentHeight = spec.heightPx - 2 * spec.marginPx;

  for (const key of Object.keys(all).sort((a, b) => Number(a) - Number(b))) {
    const background = all[key];
    if (!background || !hasPageBackground(background)) {
      continue;
    }
    const pageIndex = Number(key);
    const top = pageIndex * contentHeight - spec.marginPx;
    const left = -spec.marginPx;
    const imageUrl = background.imageKey
      ? assetUrl(String(background.imageKey), { baseUrl: options?.assetBaseUrl, token: options?.assetToken })
      : null;
    const color = parseHexColor(background.color);
    const colorHtml = color
      ? `<div class="print-page-background-color" style="background-color:${escapeHtml(color)};opacity:${clampOpacity(background.colorOpacity) / 100}"></div>`
      : "";
    const imageHtml = imageUrl
      ? `<div class="print-page-background-image" style="${escapeHtml(cssDeclarations({
          backgroundImage: `url(${JSON.stringify(imageUrl)})`,
          backgroundSize: fitToCss(background.imageFit),
          backgroundPosition: positionToCss(background.imagePosition),
          backgroundRepeat: background.imageRepeat ? "repeat" : "no-repeat",
          opacity: String(clampOpacity(background.imageOpacity) / 100),
        }))}"></div>`
      : "";
    layers.push(
      `<div class="print-page-background" data-page="${pageIndex}" style="top:${top}px;left:${left}px;width:${spec.widthPx}px;height:${spec.heightPx}px">${colorHtml}${imageHtml}</div>`,
    );
  }

  if (!layers.length) {
    return "";
  }
  return `<div class="print-page-backgrounds" aria-hidden="true">${layers.join("")}</div>`;
}

export function printPageBackgroundCss(): string {
  return `
.print-root { position: relative; }
.print-page-backgrounds { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.print-page-background {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-page-background-color,
.print-page-background-image {
  position: absolute;
  inset: 0;
}
.print-page-background-image { background-color: transparent; }
article { position: relative; z-index: 1; background: transparent; }
`.trim();
}

export function formatInches(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatMb(bytes: number): string {
  return String(Math.round(bytes / (1024 * 1024)));
}

function parsePageBackground(value: unknown): PageBackground | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  return compactPageBackground({
    color: parseHexColor(raw.color),
    colorOpacity: "colorOpacity" in raw ? clampOpacity(raw.colorOpacity) : undefined,
    imageKey: typeof raw.imageKey === "string" && raw.imageKey.trim() ? raw.imageKey.trim() : null,
    imageFit: parseFit(raw.imageFit),
    imagePosition: parsePosition(raw.imagePosition),
    imageRepeat: raw.imageRepeat === true,
    imageOpacity: "imageOpacity" in raw ? clampOpacity(raw.imageOpacity) : undefined,
  });
}

function compactPageBackground(background: PageBackground): PageBackground | null {
  const color = parseHexColor(background.color);
  const imageKey = background.imageKey && String(background.imageKey).trim() ? String(background.imageKey).trim() : null;
  if (!color && !imageKey) {
    return null;
  }
  const next: PageBackground = {};
  if (color) {
    next.color = color;
    next.colorOpacity = clampOpacity(background.colorOpacity);
  }
  if (imageKey) {
    next.imageKey = imageKey;
    next.imageFit = parseFit(background.imageFit);
    next.imagePosition = parsePosition(background.imagePosition);
    next.imageRepeat = background.imageRepeat === true;
    next.imageOpacity = clampOpacity(background.imageOpacity);
  }
  return next;
}

function parseFit(value: unknown): PageBackgroundFit {
  return typeof value === "string" && FITS.has(value as PageBackgroundFit) ? (value as PageBackgroundFit) : "fill";
}

function parsePosition(value: unknown): PageBackgroundPosition {
  return typeof value === "string" && POSITIONS.has(value as PageBackgroundPosition)
    ? (value as PageBackgroundPosition)
    : "top-left";
}

function parseHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.trim();
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) {
    return raw.toLowerCase();
  }
  return null;
}

function clampOpacity(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

function fitToCss(fit: PageBackgroundFit | undefined): string {
  if (fit === "fit") {
    return "contain";
  }
  if (fit === "stretch") {
    return "100% 100%";
  }
  return "cover";
}

function positionToCss(position: PageBackgroundPosition | undefined): string {
  switch (position) {
    case "top-center":
      return "top center";
    case "top-right":
      return "top right";
    case "center-left":
      return "center left";
    case "center":
      return "center";
    case "center-right":
      return "center right";
    case "bottom-left":
      return "bottom left";
    case "bottom-center":
      return "bottom center";
    case "bottom-right":
      return "bottom right";
    default:
      return "top left";
  }
}

function cssDeclarations(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([key, value]) => `${hyphenate(key)}:${value}`)
    .join(";");
}

function hyphenate(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
