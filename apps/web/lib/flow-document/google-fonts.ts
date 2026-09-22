/**
 * Curated Google Fonts for the Flow Document editor (Docs-like font picker).
 * Loaded via stylesheets/css2 — no paid APIs.
 */

export type FlowGoogleFont = {
  id: string;
  label: string;
  /** CSS font-family value applied to the textStyle mark */
  family: string;
  /** Google Fonts family name for the CSS2 API (omit for system fonts) */
  googleFamily?: string;
};

export const FLOW_GOOGLE_FONTS: FlowGoogleFont[] = [
  { id: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { id: "roboto", label: "Roboto", family: '"Roboto", Arial, sans-serif', googleFamily: "Roboto:wght@400;500;700" },
  {
    id: "open-sans",
    label: "Open Sans",
    family: '"Open Sans", Arial, sans-serif',
    googleFamily: "Open+Sans:wght@400;600;700",
  },
  {
    id: "lato",
    label: "Lato",
    family: '"Lato", Arial, sans-serif',
    googleFamily: "Lato:wght@400;700",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    family: '"Montserrat", Arial, sans-serif',
    googleFamily: "Montserrat:wght@400;600;700",
  },
  {
    id: "source-sans",
    label: "Source Sans 3",
    family: '"Source Sans 3", Arial, sans-serif',
    googleFamily: "Source+Sans+3:wght@400;600;700",
  },
  {
    id: "nunito",
    label: "Nunito",
    family: '"Nunito", Arial, sans-serif',
    googleFamily: "Nunito:wght@400;600;700",
  },
  {
    id: "raleway",
    label: "Raleway",
    family: '"Raleway", Arial, sans-serif',
    googleFamily: "Raleway:wght@400;600;700",
  },
  {
    id: "poppins",
    label: "Poppins",
    family: '"Poppins", Arial, sans-serif',
    googleFamily: "Poppins:wght@400;500;600;700",
  },
  {
    id: "inter",
    label: "Inter",
    family: '"Inter", Arial, sans-serif',
    googleFamily: "Inter:wght@400;500;600;700",
  },
  {
    id: "merriweather",
    label: "Merriweather",
    family: '"Merriweather", Georgia, serif',
    googleFamily: "Merriweather:wght@400;700",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    family: '"Playfair Display", Georgia, serif',
    googleFamily: "Playfair+Display:wght@400;700",
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    family: '"Libre Baskerville", Georgia, serif',
    googleFamily: "Libre+Baskerville:wght@400;700",
  },
  {
    id: "crimson",
    label: "Crimson Text",
    family: '"Crimson Text", Georgia, serif',
    googleFamily: "Crimson+Text:wght@400;600;700",
  },
  { id: "georgia", label: "Georgia", family: "Georgia, serif" },
  { id: "times", label: '"Times New Roman"', family: '"Times New Roman", Times, serif' },
  { id: "courier", label: "Courier New", family: '"Courier New", Courier, monospace' },
  {
    id: "roboto-mono",
    label: "Roboto Mono",
    family: '"Roboto Mono", "Courier New", monospace',
    googleFamily: "Roboto+Mono:wght@400;500;700",
  },
];

export const FLOW_DEFAULT_FONT = FLOW_GOOGLE_FONTS.find((f) => f.id === "arial")!;

/** Google Fonts CSS2 URL covering all curated webfonts. */
export function flowGoogleFontsStylesheetHref(): string {
  const families = FLOW_GOOGLE_FONTS.filter((f) => f.googleFamily)
    .map((f) => `family=${f.googleFamily}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export const FLOW_FONT_SIZES_PT = [
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "18",
  "24",
  "30",
  "36",
  "48",
  "60",
  "72",
  "96",
] as const;

export function fontSizeToCss(pt: string): string {
  return `${pt}pt`;
}

export function cssFontSizeToPt(css: string | null | undefined): string {
  if (!css) {
    return "11";
  }
  const pt = css.match(/^([\d.]+)\s*pt$/i);
  if (pt) {
    return String(Math.round(Number(pt[1])));
  }
  const px = css.match(/^([\d.]+)\s*px$/i);
  if (px) {
    return String(Math.round((Number(px[1]) * 72) / 96));
  }
  return "11";
}
