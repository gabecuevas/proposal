"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  COMMERCIAL_VARIABLE_GROUPS,
  type CommercialVariableDef,
} from "@/lib/commercial/variables";

type Props = {
  usageCounts: Record<string, number>;
  values?: Record<string, string>;
  locked?: boolean;
  onClose: () => void;
  onInsert: (key: string) => void;
  onChangeValue?: (key: string, value: string) => void;
};

/**
 * Expandable Variables panel for Quote/Invoice — insert `[Token]` placeholders
 * that auto-fill from sender/recipient context when sending.
 * Recipient group is listed first.
 */
export function CommercialVariablesPanel({
  usageCounts,
  values = {},
  locked = false,
  onClose,
  onInsert,
  onChangeValue,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuKey, setMenuKey] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return COMMERCIAL_VARIABLE_GROUPS;
    }
    return COMMERCIAL_VARIABLE_GROUPS.map((group) => ({
      ...group,
      variables: group.variables.filter(
        (variable) =>
          variable.key.toLowerCase().includes(q) || variable.label.toLowerCase().includes(q),
      ),
    })).filter((group) => group.variables.length > 0);
  }, [query]);

  const shownCount = filteredGroups.reduce((sum, group) => sum + group.variables.length, 0);

  function highlightKey(key: string): ReactNode {
    const q = query.trim();
    if (!q) {
      return key;
    }
    const lower = key.toLowerCase();
    const index = lower.indexOf(q.toLowerCase());
    if (index < 0) {
      return key;
    }
    return (
      <>
        {key.slice(0, index)}
        <mark className="flow-variables-mark">{key.slice(index, index + q.length)}</mark>
        {key.slice(index + q.length)}
      </>
    );
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(`[${key}]`);
    } catch {
      // ignore clipboard failures
    }
    setMenuKey(null);
  }

  return (
    <aside className="flow-variables-panel" aria-label="Variables">
      <div className="flow-variables-header">
        <div className="flow-variables-title-row">
          <span className="flow-variables-title-icon" aria-hidden>
            {"{ }"}
          </span>
          <h2 className="flow-variables-title">Variables</h2>
        </div>
        <button
          type="button"
          className="flow-variables-close"
          onClick={onClose}
          aria-label="Close variables"
        >
          ×
        </button>
      </div>

      <div className="flow-variables-toolbar">
        <label className="flow-variables-search">
          <span className="flow-variables-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            aria-label="Search variables"
          />
        </label>
        <div className="flow-variables-meta">
          <span>{shownCount} VARIABLES SHOWN</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[#64748b]">
          Yellow tokens auto-fill from recipient and sender details when you send.
        </p>
      </div>

      <div className="flow-variables-list">
        {filteredGroups.map((group) => {
          const isCollapsed = Boolean(collapsed[group.id]);
          return (
            <section key={group.id} className="flow-variables-group">
              <button
                type="button"
                className="flow-variables-group-toggle"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                }
                aria-expanded={!isCollapsed}
              >
                <span className="flow-variables-group-title">{group.title}</span>
                <span className="flow-variables-group-chevron" aria-hidden>
                  {isCollapsed ? "›" : "⌃"}
                </span>
              </button>
              {!isCollapsed ? (
                <>
                  <p className="flow-variables-group-desc">{group.description}</p>
                  <ul className="flow-variables-rows">
                    {group.variables.map((variable) => (
                      <VariableRow
                        key={variable.key}
                        variable={variable}
                        value={values[variable.key] ?? ""}
                        usage={usageCounts[variable.key] ?? 0}
                        highlight={highlightKey}
                        menuOpen={menuKey === variable.key}
                        locked={locked}
                        onToggleMenu={() =>
                          setMenuKey((prev) => (prev === variable.key ? null : variable.key))
                        }
                        onInsert={() => {
                          onInsert(variable.key);
                          setMenuKey(null);
                        }}
                        onCopy={() => void copyKey(variable.key)}
                        onCommitValue={(next) => onChangeValue?.(variable.key, next)}
                      />
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          );
        })}
        {filteredGroups.length === 0 ? (
          <p className="flow-variables-empty">No variables match “{query.trim()}”.</p>
        ) : null}
      </div>
    </aside>
  );
}

function VariableRow({
  variable,
  value,
  usage,
  highlight,
  menuOpen,
  locked,
  onToggleMenu,
  onInsert,
  onCopy,
  onCommitValue,
}: {
  variable: CommercialVariableDef;
  value: string;
  usage: number;
  highlight: (key: string) => ReactNode;
  menuOpen: boolean;
  locked: boolean;
  onToggleMenu: () => void;
  onInsert: () => void;
  onCopy: () => void;
  onCommitValue: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <li className="flow-variables-row">
      <div className="flow-variables-row-top">
        <button
          type="button"
          className="flow-variables-key"
          title={`Insert [${variable.key}]`}
          disabled={locked}
          onClick={onInsert}
        >
          [{highlight(variable.key)}]
        </button>
        <span className="flow-variables-count" title={`Used ${usage} time${usage === 1 ? "" : "s"}`}>
          {usage}
        </span>
        <div className="flow-variables-row-menu">
          <button
            type="button"
            className="flow-variables-row-more"
            aria-label={`${variable.key} options`}
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
          >
            ···
          </button>
          {menuOpen ? (
            <div role="menu" className="flow-variables-row-dropdown">
              <button type="button" role="menuitem" onClick={onInsert} disabled={locked}>
                Insert into document
              </button>
              <button type="button" role="menuitem" onClick={onCopy}>
                Copy as [key]
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <input
        type="text"
        className="flow-variables-value"
        value={draft}
        placeholder={variable.label}
        disabled={locked}
        aria-label={`${variable.key} value`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) {
            onCommitValue(draft);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
      />
    </li>
  );
}
