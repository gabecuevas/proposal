"use client";

import { IconPalette } from "@/components/editor/creator/creator-icons";

type ShelfPanel = "variables" | "page" | null;

type Props = {
  activePanel: ShelfPanel;
  variableCount: number;
  propertiesPage: number | null;
  onSelect: (panel: Exclude<ShelfPanel, null>) => void;
  onCollapse: () => void;
};

/**
 * Narrow right icon rail — click an icon to expand that panel.
 */
export function FlowToolShelf({
  activePanel,
  variableCount,
  propertiesPage,
  onSelect,
  onCollapse,
}: Props) {
  const expanded = activePanel != null;

  return (
    <aside className="flow-tool-shelf" aria-label="Document tools">
      <button
        type="button"
        className="flow-tool-shelf-toggle"
        onClick={() => (expanded ? onCollapse() : onSelect("variables"))}
        aria-label={expanded ? "Collapse side panel" : "Expand side panel"}
        title={expanded ? "Collapse" : "Expand"}
      >
        {expanded ? "»" : "«"}
      </button>

      <button
        type="button"
        className={`flow-tool-shelf-icon${activePanel === "variables" ? " is-active" : ""}`}
        onClick={() => (activePanel === "variables" ? onCollapse() : onSelect("variables"))}
        aria-label="Variables"
        aria-pressed={activePanel === "variables"}
        title="Variables"
      >
        <span className="flow-tool-shelf-glyph" aria-hidden>
          {"{ }"}
        </span>
        {variableCount > 0 ? (
          <span className="flow-tool-shelf-badge">{variableCount > 99 ? "99+" : variableCount}</span>
        ) : null}
      </button>

      {propertiesPage != null ? (
        <button
          type="button"
          className={`flow-tool-shelf-icon${activePanel === "page" ? " is-active" : ""}`}
          onClick={() => (activePanel === "page" ? onCollapse() : onSelect("page"))}
          aria-label="Page properties"
          aria-pressed={activePanel === "page"}
          title="Page properties"
        >
          <span className="flow-tool-shelf-glyph" aria-hidden>
            <IconPalette />
          </span>
        </button>
      ) : null}
    </aside>
  );
}
