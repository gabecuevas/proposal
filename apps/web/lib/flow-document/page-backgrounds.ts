/**
 * Flow page backgrounds — persisted on editor_json.doc.attrs.flow_page_backgrounds.
 */
import type { EditorDoc, JSONValue } from "@/lib/editor/types";
import {
  parsePageBackgrounds,
  patchPageBackground,
  type PageBackground,
  type PageBackgrounds,
} from "@/lib/editor/page-backgrounds";

export const FLOW_PAGE_BACKGROUNDS_ATTR = "flow_page_backgrounds";

export function flowPageBackgroundsFromDoc(doc: EditorDoc | null | undefined): PageBackgrounds {
  const attrs = doc?.attrs ?? {};
  // Prefer Flow attr; fall back to Creator attr if present on imported docs.
  if (attrs[FLOW_PAGE_BACKGROUNDS_ATTR] != null) {
    return parsePageBackgrounds(attrs[FLOW_PAGE_BACKGROUNDS_ATTR]);
  }
  return parsePageBackgrounds(attrs.pageBackgrounds);
}

export function withFlowPageBackgrounds(doc: EditorDoc, backgrounds: PageBackgrounds): EditorDoc {
  const next = structuredClone(doc);
  next.attrs = { ...(next.attrs ?? {}) };
  if (Object.keys(backgrounds).length === 0) {
    delete next.attrs[FLOW_PAGE_BACKGROUNDS_ATTR];
  } else {
    next.attrs[FLOW_PAGE_BACKGROUNDS_ATTR] = backgrounds as unknown as JSONValue;
  }
  return next;
}

export function patchFlowPageBackground(
  all: PageBackgrounds,
  pageIndex: number,
  patch: Partial<PageBackground>,
): PageBackgrounds {
  return patchPageBackground(all, pageIndex, patch);
}
