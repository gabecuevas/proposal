export const FONT_FAMILIES = [
  { id: "", label: "Default" },
  { id: "Arial, Helvetica, sans-serif", label: "Arial" },
  { id: "Georgia, serif", label: "Georgia" },
  { id: '"Times New Roman", Times, serif', label: "Times New Roman" },
  { id: '"Courier New", Courier, monospace', label: "Courier New" },
  { id: "ui-sans-serif, system-ui, sans-serif", label: "System" },
] as const;

export const LINE_HEIGHTS = [
  { id: "", label: "Default" },
  { id: "1", label: "Single" },
  { id: "1.15", label: "1.15" },
  { id: "1.5", label: "1.5" },
  { id: "2", label: "Double" },
] as const;

export const TEXT_COLORS = [
  "#0f172a",
  "#1e3a5f",
  "#334155",
  "#64748b",
  "#dc2626",
  "#d97706",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#ffffff",
] as const;

export const HIGHLIGHT_COLORS = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fecaca",
  "#e9d5ff",
  "#fed7aa",
  "#e2e8f0",
] as const;

export type BlockStyleId = "paragraph" | "h1" | "h2" | "h3";

export const BLOCK_STYLES: { id: BlockStyleId; label: string }[] = [
  { id: "paragraph", label: "Normal text" },
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
];

export const INDENT_STEP_PX = 24;
export const INDENT_MAX = 8;
