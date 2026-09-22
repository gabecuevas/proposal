"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { insertVariable } from "@/lib/editor/insert-elements";
import type { EditorDoc, VariableContext } from "@/lib/editor/types";
import {
  buildFlowVariableGroups,
  countVariableUsages,
  getVariablePathValue,
  setVariablePathValue,
  type FlowVariableDef,
} from "@/lib/flow-document/variable-catalog";

type Props = {
  editor: Editor | null;
  variables: VariableContext;
  locked?: boolean;
  onClose: () => void;
  onChangeVariables: (next: VariableContext) => void;
};

/**
 * Expandable Variables panel — search, grouped lists, usage counts, value inputs.
 */
export function FlowVariablesPanel({
  editor,
  variables,
  locked = false,
  onClose,
  onChangeVariables,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const bump = () => setTick((n) => n + 1);
    editor.on("update", bump);
    return () => {
      editor.off("update", bump);
    };
  }, [editor]);

  const usageCounts = useMemo(() => {
    void tick;
    return countVariableUsages((editor?.getJSON() as EditorDoc | undefined) ?? null);
  }, [editor, tick]);

  const groups = useMemo(() => buildFlowVariableGroups(variables, usageCounts), [variables, usageCounts]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        variables: group.variables.filter(
          (variable) =>
            variable.key.toLowerCase().includes(q) || variable.label.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.variables.length > 0);
  }, [groups, query]);

  const shownCount = filteredGroups.reduce((sum, group) => sum + group.variables.length, 0);

  useEffect(() => {
    if (menuKey == null) {
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".flow-variables-row-menu")) {
        return;
      }
      setMenuKey(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuKey(null);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuKey]);

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

  function insertKey(key: string) {
    if (!editor || locked) {
      return;
    }
    insertVariable(editor, key);
    setMenuKey(null);
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
            ▤
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
                        value={getVariablePathValue(variables, variable.key)}
                        usage={usageCounts[variable.key] ?? 0}
                        highlight={highlightKey}
                        menuOpen={menuKey === variable.key}
                        locked={locked}
                        onToggleMenu={() =>
                          setMenuKey((prev) => (prev === variable.key ? null : variable.key))
                        }
                        onInsert={() => insertKey(variable.key)}
                        onCopy={() => void copyKey(variable.key)}
                        onCommitValue={(nextValue) => {
                          onChangeVariables(setVariablePathValue(variables, variable.key, nextValue));
                        }}
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
  variable: FlowVariableDef;
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
          title={`Insert ${variable.key}`}
          disabled={locked}
          onClick={onInsert}
        >
          {highlight(variable.key)}
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
        placeholder="None"
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
