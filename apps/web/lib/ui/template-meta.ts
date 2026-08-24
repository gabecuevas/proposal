import type { EditorDoc } from "@/lib/editor/types";

function walkContent(nodes: unknown[], visit: (node: { type?: string; content?: unknown[] }) => void) {
  if (!Array.isArray(nodes)) {
    return;
  }
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const n = node as { type?: string; content?: unknown[] };
    visit(n);
    if (Array.isArray(n.content)) {
      walkContent(n.content, visit);
    }
  }
}

/**
 * Uploaded templates carry a rendered image of each page, so the first one
 * doubles as the gallery thumbnail.
 */
export function templateThumbnailKey(doc: EditorDoc | null | undefined): string | null {
  if (!doc?.content?.length) {
    return null;
  }
  let key: string | null = null;
  walkContent(doc.content, (n) => {
    if (key || n.type !== "fieldCanvas") {
      return;
    }
    const bgKey = (n as { attrs?: { bgKey?: unknown } }).attrs?.bgKey;
    if (typeof bgKey === "string" && bgKey) {
      key = bgKey;
    }
  });
  return key;
}

export function pageCountFromEditor(doc: EditorDoc | null | undefined): number {
  if (!doc?.content?.length) {
    return 1;
  }
  let breaks = 0;
  walkContent(doc.content, (n) => {
    if (n.type === "pageBreak") {
      breaks += 1;
    }
  });
  return Math.max(1, breaks + 1);
}

const CATEGORY_PRESETS = [
  { id: "all", label: "All", match: () => true },
  {
    id: "proposals",
    label: "Proposals",
    match: (tags: string[]) =>
      tags.some((t) => {
        const x = t.toLowerCase();
        return x === "proposal" || x === "proposals";
      }),
  },
  {
    id: "contracts",
    label: "Contracts",
    match: (tags: string[]) =>
      tags.some((t) => {
        const x = t.toLowerCase();
        return x === "contract" || x === "contracts";
      }),
  },
  {
    id: "ndas",
    label: "NDAs",
    match: (tags: string[]) =>
      tags.some((t) => {
        const x = t.toLowerCase();
        return x === "nda" || x === "ndas";
      }),
  },
  {
    id: "quotes",
    label: "Quotes",
    match: (tags: string[]) =>
      tags.some((t) => {
        const x = t.toLowerCase();
        return x === "quote" || x === "quotes";
      }),
  },
  {
    id: "invoices",
    label: "Invoices",
    match: (tags: string[]) =>
      tags.some((t) => {
        const x = t.toLowerCase();
        return x === "invoice" || x === "invoices";
      }),
  },
] as const;

export type TemplateCategoryId = (typeof CATEGORY_PRESETS)[number]["id"];

export function templateCategoryTabs() {
  return CATEGORY_PRESETS;
}

export function templateMatchesCategory(tags: string[], categoryId: TemplateCategoryId): boolean {
  const preset = CATEGORY_PRESETS.find((c) => c.id === categoryId);
  if (!preset || categoryId === "all") {
    return true;
  }
  return preset.match(tags);
}

export function templateSubtitleFromTags(tags: string[]): string {
  if (tags.length === 0) {
    return "General";
  }
  const t = tags[0]!;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
