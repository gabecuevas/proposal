import type { EditorDoc, EditorNode } from "./types";
import { attrsToJson, parseSignerFieldAttrs } from "./signer-field-attrs";

function migrateParagraph(node: EditorNode): EditorNode[] {
  const content = node.content ?? [];
  if (content.length === 0) {
    return [node];
  }
  const result: EditorNode[] = [];
  let textBuf: EditorNode[] = [];
  let fieldBuf: EditorNode[] = [];

  const flushPara = () => {
    if (textBuf.length) {
      result.push({ type: "paragraph", content: textBuf });
      textBuf = [];
    }
  };

  const flushCanvas = () => {
    if (fieldBuf.length) {
      result.push({
        type: "fieldCanvas",
        content: fieldBuf.map((field, index) => {
          const attrs = parseSignerFieldAttrs(field.attrs as Record<string, unknown>, index);
          return {
            type: "signerField",
            attrs: attrsToJson(attrs),
          };
        }),
      });
      fieldBuf = [];
    }
  };

  for (const child of content) {
    if (child.type === "signerField") {
      flushPara();
      fieldBuf.push(child);
    } else {
      flushCanvas();
      textBuf.push(child);
    }
  }

  flushPara();
  flushCanvas();
  return result;
}

function mapNode(node: EditorNode): EditorNode[] {
  if (node.type === "paragraph") {
    return migrateParagraph(node);
  }
  if (node.content) {
    const newContent = node.content.flatMap((child) => mapNode(child));
    return [{ ...node, content: newContent }];
  }
  return [node];
}

/**
 * Lifts legacy inline `signerField` atoms into `fieldCanvas` blocks with normalized layout attrs.
 * Safe to call multiple times (idempotent for already-migrated docs).
 */
export function migrateSignerFieldsDoc(doc: EditorDoc): EditorDoc {
  if (!doc.content) {
    return doc;
  }

  const nextContent = doc.content.flatMap((block) => mapNode(block));
  return {
    type: "doc",
    attrs: doc.attrs,
    content: nextContent,
  };
}
