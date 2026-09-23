/**
 * Visible screenshot aliases → existing CRM / sender variable keys.
 *
 * Templates store the visible `[Sender.FullName]` form; resolution maps
 * through this table onto workspace/contact context values.
 */

export const COMMERCIAL_VARIABLE_ALIASES: Record<string, string[]> = {
  "Sender.FullName": ["Sender.FullName", "sender_full_name", "sender.name", "user.name"],
  "Sender.CompanyName": [
    "Sender.CompanyName",
    "sender_company_name",
    "Company.Name",
    "workspace.name",
  ],
  "Sender.FullAddress": [
    "Sender.FullAddress",
    "sender_full_address",
    "Company.Address",
    "workspace.address",
  ],
  "Sender.Phone": ["Sender.Phone", "sender_phone", "Company.Phone", "workspace.phone"],
  "Recipient.CompanyName": [
    "Recipient.CompanyName",
    "Company.Name",
    "client.company",
    "company_name",
  ],
  "Recipient.FullName": ["Recipient.FullName", "Client.FullName", "client.name"],
  "Recipient.Email": ["Recipient.Email", "Client.Email", "client.email"],
  "Recipient.Phone": ["Recipient.Phone", "Client.Phone"],
};

export type CommercialVariableDef = {
  key: string;
  label: string;
};

export type CommercialVariableGroup = {
  id: string;
  title: string;
  description: string;
  variables: CommercialVariableDef[];
};

export const COMMERCIAL_VARIABLE_GROUPS: CommercialVariableGroup[] = [
  {
    id: "recipient",
    title: "Recipient",
    description: "Bill-to client details — auto-filled from the contact.",
    variables: [
      { key: "Recipient.CompanyName", label: "Company name" },
      { key: "Recipient.FullName", label: "Full name" },
      { key: "Recipient.Email", label: "Email" },
      { key: "Recipient.Phone", label: "Phone" },
    ],
  },
  {
    id: "sender",
    title: "Sender",
    description: "Your company and contact details — auto-filled when sending.",
    variables: [
      { key: "Sender.FullName", label: "Full name" },
      { key: "Sender.CompanyName", label: "Company name" },
      { key: "Sender.FullAddress", label: "Full address" },
      { key: "Sender.Phone", label: "Phone" },
    ],
  },
];

export const COMMERCIAL_TOKEN_RE = /\[([A-Za-z][A-Za-z0-9_.]*)\]/g;

export function extractCommercialTokens(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(COMMERCIAL_TOKEN_RE)) {
    if (match[1]) {
      found.add(match[1]);
    }
  }
  return [...found];
}

export function countCommercialTokenUsages(texts: string[]): number {
  let total = 0;
  for (const text of texts) {
    total += extractCommercialTokens(text).length;
  }
  return total;
}

export function countCommercialTokenUsageMap(texts: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const text of texts) {
    for (const token of extractCommercialTokens(text)) {
      counts[token] = (counts[token] ?? 0) + 1;
    }
  }
  return counts;
}

export function resolveCommercialToken(
  token: string,
  context: Record<string, unknown>,
): string | null {
  const aliases = COMMERCIAL_VARIABLE_ALIASES[token] ?? [token];
  for (const key of aliases) {
    const value = context[key];
    if (value == null) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return null;
}

export function resolveCommercialText(
  text: string,
  context: Record<string, unknown>,
  options?: { keepUnresolved?: boolean },
): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const keep = options?.keepUnresolved !== false;
  const next = text.replace(COMMERCIAL_TOKEN_RE, (full, token: string) => {
    const resolved = resolveCommercialToken(token, context);
    if (resolved == null) {
      unresolved.push(token);
      return keep ? full : "";
    }
    return resolved;
  });
  return { text: next, unresolved: [...new Set(unresolved)] };
}

export function hasUnresolvedTokens(text: string, context: Record<string, unknown>): boolean {
  return resolveCommercialText(text, context).unresolved.length > 0;
}

/** Insert `[Key]` into text at a caret range. */
export function insertCommercialTokenAt(
  text: string,
  key: string,
  start: number,
  end: number,
): { text: string; caret: number } {
  const token = `[${key}]`;
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  return {
    text: `${text.slice(0, safeStart)}${token}${text.slice(safeEnd)}`,
    caret: safeStart + token.length,
  };
}
