import type { JSONValue, VariableContext, VariableRegistry } from "./types";

function getPathValue(source: Record<string, JSONValue>, path: string): JSONValue | undefined {
  const parts = path.split(".");
  let current: JSONValue | undefined = source;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, JSONValue>)[part];
  }
  return current;
}

export function resolveTemplateVariables(
  registry: VariableRegistry,
  context: VariableContext,
): { resolved: Record<string, JSONValue>; missing: string[] } {
  const resolved: Record<string, JSONValue> = {};
  const missing: string[] = [];

  for (const [key, def] of Object.entries(registry)) {
    const value = getPathValue(context, key);
    if (value === undefined || value === null || value === "") {
      if (def.required) {
        missing.push(key);
      }
      continue;
    }
    resolved[key] = value;
  }

  return { resolved, missing: missing.sort() };
}

export function renderVariableText(
  key: string,
  resolved: Record<string, JSONValue>,
  fallback?: string,
): string {
  const value = resolved[key];
  if (value === undefined || value === null || value === "") {
    return fallback ?? `{{${key}}}`;
  }
  return String(value);
}
