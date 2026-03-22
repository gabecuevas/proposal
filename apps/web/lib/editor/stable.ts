import type { EditorDoc, EditorNode, JSONValue } from "./types";

function sortObject(input: Record<string, JSONValue>): Record<string, JSONValue> {
  const out: Record<string, JSONValue> = {};
  for (const key of Object.keys(input).sort()) {
    const value = input[key];
    if (value !== undefined) {
      out[key] = normalizeStable(value);
    }
  }
  return out;
}

function sortMarks(
  marks: { type: string; attrs?: Record<string, JSONValue> }[],
): { type: string; attrs?: Record<string, JSONValue> }[] {
  return [...marks]
    .map((mark) => ({
      ...mark,
      attrs: mark.attrs ? sortObject(mark.attrs) : undefined,
    }))
    .sort((a, b) => {
      const left = `${a.type}:${JSON.stringify(a.attrs ?? {})}`;
      const right = `${b.type}:${JSON.stringify(b.attrs ?? {})}`;
      return left.localeCompare(right);
    });
}

function normalizeNode(node: EditorNode): EditorNode {
  return {
    type: node.type,
    attrs: node.attrs ? sortObject(node.attrs) : undefined,
    text: node.text,
    marks: node.marks ? sortMarks(node.marks) : undefined,
    content: node.content ? node.content.map(normalizeNode) : undefined,
  };
}

export function normalizeStable(value: JSONValue): JSONValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeStable);
  }

  return sortObject(value);
}

export function normalizeEditorDoc(doc: EditorDoc): EditorDoc {
  return {
    type: "doc",
    content: doc.content.map(normalizeNode),
  };
}

export function serializeStable(docJson: EditorDoc): string {
  return JSON.stringify(normalizeEditorDoc(docJson));
}
