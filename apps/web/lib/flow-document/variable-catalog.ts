/**
 * Flow variable catalog — Recipient / Client / Company groups + CUSTOM leftovers.
 */
import {
  CLIENT_VARIABLES,
  COMPANY_VARIABLES,
  RECIPIENT_VARIABLES,
  SENDER_VARIABLES,
} from "@/lib/crm/variables";
import type { EditorDoc, JSONValue, VariableContext } from "@/lib/editor/types";

export type FlowVariableDef = {
  key: string;
  label: string;
};

export type FlowVariableGroup = {
  id: string;
  title: string;
  description: string;
  variables: FlowVariableDef[];
};

/** Built-in Flow variables (shown even when unused / unset). */
export const FLOW_RECIPIENT_VARIABLES: FlowVariableDef[] = RECIPIENT_VARIABLES.map((item) => ({
  key: item.key,
  label: item.label,
}));

const STANDARD_KEYS = new Set<string>([
  ...FLOW_RECIPIENT_VARIABLES.map((v) => v.key),
  ...SENDER_VARIABLES.map((v) => v.key),
  ...CLIENT_VARIABLES.map((v) => v.key),
  ...COMPANY_VARIABLES.map((v) => v.key),
]);

/** Keys reserved for document metadata — never shown as editable variables. */
const META_KEYS = new Set(["editor_layout", "document_kind", "title"]);

export function getVariablePathValue(context: VariableContext, path: string): string {
  const parts = path.split(".");
  let current: JSONValue | undefined = context as JSONValue;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return "";
    }
    current = (current as Record<string, JSONValue>)[part];
  }
  if (current === undefined || current === null) {
    return "";
  }
  return String(current);
}

export function setVariablePathValue(
  context: VariableContext,
  path: string,
  value: string,
): VariableContext {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) {
    return context;
  }
  const next = structuredClone(context) as Record<string, JSONValue>;
  let cursor: Record<string, JSONValue> = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, JSONValue>;
  }
  const leaf = parts[parts.length - 1]!;
  if (value.trim() === "") {
    delete cursor[leaf];
  } else {
    cursor[leaf] = value;
  }
  return next as VariableContext;
}

/** Count `variableToken` usages keyed by attrs.key. */
export function countVariableUsages(doc: EditorDoc | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  walkNodes(doc?.content, (node) => {
    if (node.type !== "variableToken") {
      return;
    }
    const key = String(node.attrs?.key ?? "").trim();
    if (!key) {
      return;
    }
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
}

function walkNodes(
  nodes: EditorDoc["content"] | undefined,
  visit: (node: { type?: string; attrs?: Record<string, unknown>; content?: EditorDoc["content"] }) => void,
) {
  if (!nodes) {
    return;
  }
  for (const node of nodes) {
    visit(node as { type?: string; attrs?: Record<string, unknown>; content?: EditorDoc["content"] });
    if (Array.isArray((node as { content?: unknown }).content)) {
      walkNodes((node as { content: EditorDoc["content"] }).content, visit);
    }
  }
}

function flattenContextKeys(context: VariableContext, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (!prefix && META_KEYS.has(key)) {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenContextKeys(value as VariableContext, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/**
 * Build grouped catalog for the Variables panel.
 * Standard groups always appear; CUSTOM collects leftover context/doc keys.
 */
export function buildFlowVariableGroups(
  context: VariableContext,
  usageCounts: Record<string, number>,
): FlowVariableGroup[] {
  const customKeys = new Set<string>([
    ...flattenContextKeys(context),
    ...Object.keys(usageCounts),
  ]);
  for (const key of STANDARD_KEYS) {
    customKeys.delete(key);
  }

  const customVariables: FlowVariableDef[] = [...customKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, label: key.split(".").pop() || key }));

  const groups: FlowVariableGroup[] = [
    {
      id: "recipient",
      title: "Recipient",
      description: "Values filled for the document recipient.",
      variables: FLOW_RECIPIENT_VARIABLES,
    },
    {
      id: "sender",
      title: "Sender",
      description: "Your company and contact details.",
      variables: SENDER_VARIABLES.map((v) => ({ key: v.key, label: v.label })),
    },
    {
      id: "client",
      title: "Client",
      description: "Client contact fields from CRM or manual entry.",
      variables: CLIENT_VARIABLES.map((v) => ({ key: v.key, label: v.label })),
    },
    {
      id: "company",
      title: "Company",
      description: "Company fields from CRM or manual entry.",
      variables: COMPANY_VARIABLES.map((v) => ({ key: v.key, label: v.label })),
    },
  ];

  if (customVariables.length > 0) {
    groups.push({
      id: "custom",
      title: "Custom",
      description: "These variables are created and named by users.",
      variables: customVariables,
    });
  }

  return groups;
}
