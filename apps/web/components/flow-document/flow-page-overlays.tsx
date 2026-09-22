"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { measureFlowPageBands, type FlowPageBand } from "@/lib/flow-document/page-bands";
import {
  backgroundForPage,
  hasPageBackground,
  pageBackgroundLayerStyles,
  type PageBackgrounds,
} from "@/lib/editor/page-backgrounds";
import { assetUrl } from "@/lib/storage/asset-url";

type Props = {
  editor: Editor | null;
  pageCount: number;
  pageHeightPx: number;
  pageWidthPx: number;
  backgrounds: PageBackgrounds;
  locked?: boolean;
  propertiesPage: number | null;
  onOpenProperties: (page: number) => void;
  onAddBlankPage: (pageIndex: number, band: FlowPageBand) => void;
};

/**
 * Per-page chrome: centered "Page N of X", top-right ⋮ menu, and background layers.
 * Backgrounds sit behind the editor; chrome sits above with pointer-events only on the menu.
 */
export function FlowPageOverlays({
  editor,
  pageCount,
  pageHeightPx,
  pageWidthPx,
  backgrounds,
  locked = false,
  propertiesPage,
  onOpenProperties,
  onAddBlankPage,
}: Props) {
  const [bands, setBands] = useState<FlowPageBand[]>([{ top: 0, height: pageHeightPx }]);
  const [menuPage, setMenuPage] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const editorEl = editor.view.dom as HTMLElement;

    function sync() {
      setBands(measureFlowPageBands(editorEl, pageHeightPx, pageCount));
    }

    sync();
    const scroller = editorEl.closest(".flow-scroll-pane");
    scroller?.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(editorEl);
    const pagination = editorEl.querySelector("[data-rm-pagination]");
    const mo =
      typeof MutationObserver !== "undefined" && pagination
        ? new MutationObserver(sync)
        : null;
    mo?.observe(pagination as Node, { childList: true, subtree: true });
    return () => {
      scroller?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [editor, pageCount, pageHeightPx]);

  useEffect(() => {
    if (menuPage == null) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuPage(null);
      }
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuPage(null);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menuPage]);

  const pages = Math.max(1, bands.length, pageCount);

  return (
    <>
      <div className="flow-page-backgrounds" aria-hidden>
        {Array.from({ length: pages }, (_, index) => {
          const band = bands[index] ?? {
            top: index * pageHeightPx,
            height: pageHeightPx,
          };
          const background = backgroundForPage(backgrounds, index);
          const imageUrl = background.imageKey ? assetUrl(background.imageKey) : null;
          const styles = hasPageBackground(background)
            ? pageBackgroundLayerStyles(background, imageUrl)
            : null;
          return (
            <div
              key={`bg-${index}`}
              className="flow-page-background"
              style={{ top: band.top, width: pageWidthPx, height: band.height }}
            >
              {styles?.color ? (
                <div className="flow-page-background-color" style={styles.color} />
              ) : null}
              {styles?.image ? (
                <div className="flow-page-background-image" style={styles.image} />
              ) : null}
            </div>
          );
        })}
      </div>

      <div ref={rootRef} className="flow-page-overlays">
        {Array.from({ length: pages }, (_, index) => {
          const band = bands[index] ?? {
            top: index * pageHeightPx,
            height: pageHeightPx,
          };
          const page = index + 1;
          const menuOpen = menuPage === page;

          return (
            <div
              key={`page-chrome-${index}`}
              className="flow-page-chrome"
              style={{ top: band.top, height: 0, width: pageWidthPx }}
            >
              <div className="flow-page-index">
                Page {page} of {pageCount}
              </div>

              {!locked ? (
                <div className="flow-page-menu">
                  <button
                    type="button"
                    className={`flow-page-menu-trigger${menuOpen ? " is-open" : ""}${
                      propertiesPage === page ? " is-active" : ""
                    }`}
                    aria-label={`Page ${page} options`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuPage(menuOpen ? null : page)}
                  >
                    <span className="flow-page-menu-dots" aria-hidden>
                      ···
                    </span>
                  </button>
                  {menuOpen ? (
                    <div role="menu" className="flow-page-menu-dropdown">
                      <button
                        type="button"
                        role="menuitem"
                        className="flow-page-menu-item"
                        onClick={() => {
                          setMenuPage(null);
                          onAddBlankPage(index, band);
                        }}
                      >
                        Add a blank page
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flow-page-menu-item"
                        onClick={() => {
                          setMenuPage(null);
                          onOpenProperties(page);
                        }}
                      >
                        Page properties
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
