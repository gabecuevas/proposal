/**
 * Normalize Flow editor JSON so PaginationPlus can measure pages safely.
 * TipTap tables do not fragment through PaginationPlus float seams.
 */
import type { EditorDoc, JSONValue } from "@/lib/editor/types";

type PmNode = {
  type: string;
  attrs?: Record<string, JSONValue>;
  content?: PmNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, JSONValue> }>;
};

function flattenTableNode(table: PmNode): PmNode[] {
  const out: PmNode[] = [];
  for (const row of table.content ?? []) {
    if (row.type !== "tableRow") {
      continue;
    }
    for (const cell of row.content ?? []) {
      if (cell.type !== "tableCell" && cell.type !== "tableHeader") {
        continue;
      }
      const cellContent = cell.content ?? [];
      if (cellContent.length === 0) {
        out.push({ type: "paragraph" });
        continue;
      }
      out.push(...cellContent.map((node) => structuredClone(node)));
    }
  }
  return out.length > 0 ? out : [{ type: "paragraph" }];
}

function mapContent(nodes: PmNode[] | undefined): PmNode[] {
  if (!nodes?.length) {
    return [];
  }
  const out: PmNode[] = [];
  for (const node of nodes) {
    if (node.type === "table") {
      out.push(...flattenTableNode(node));
      continue;
    }
    if (node.content) {
      out.push({ ...node, content: mapContent(node.content) });
      continue;
    }
    out.push(node);
  }
  return out;
}

/** Returns a copy with tables unwrapped into sequential blocks. */
export function flattenTablesInEditorDoc(doc: EditorDoc): EditorDoc {
  const next = structuredClone(doc) as PmNode & EditorDoc;
  next.content = mapContent((doc.content as PmNode[] | undefined) ?? []);
  return next;
}

export function editorDocHasTable(doc: EditorDoc | null | undefined): boolean {
  if (!doc?.content) {
    return false;
  }
  const stack: PmNode[] = [...(doc.content as PmNode[])];
  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.type === "table") {
      return true;
    }
    if (node.content) {
      stack.push(...node.content);
    }
  }
  return false;
}
