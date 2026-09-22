"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  FLOW_DPI,
  setFlowMarginEdge,
  type FlowMarginEdge,
  type FlowPageMargins,
} from "@/lib/flow-document/page-margins";

export const FLOW_RULER_SIZE_PX = 18;

type Props = {
  scrollRef: RefObject<HTMLElement | null>;
  pageSelector?: string;
  pageWidthPx: number;
  pageHeightPx: number;
  /** PaginationPlus page count — triggers remeasure when pages are added/removed. */
  pageCount?: number;
  zoom: number;
  margins: FlowPageMargins;
  locked?: boolean;
  onChange: (next: FlowPageMargins) => void;
};

type DragState = {
  edge: FlowMarginEdge;
  startClient: number;
  startInches: number;
};

type PageBand = {
  topInViewport: number;
  height: number;
};

type PageAlign = {
  leftInViewport: number;
  scaledWidth: number;
  pages: PageBand[];
};

/**
 * Sticky Docs-style rulers for a CSS grid workspace:
 * corner (1,1) · horizontal (2,1) · vertical (1,2) · scroll pane (2,2).
 *
 * Vertical ruler renders one segment per page (with gaps between), matching
 * Google Docs multi-page behavior.
 */
export function FlowMarginRulers({
  scrollRef,
  pageSelector = ".flow-document-editor",
  pageWidthPx,
  pageHeightPx,
  pageCount = 1,
  zoom,
  margins,
  locked,
  onChange,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [align, setAlign] = useState<PageAlign>({
    leftInViewport: 0,
    scaledWidth: pageWidthPx,
    pages: [{ topInViewport: 0, height: pageHeightPx }],
  });
  const marginsRef = useRef(margins);
  marginsRef.current = margins;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const hViewportRef = useRef<HTMLDivElement>(null);
  const vViewportRef = useRef<HTMLDivElement>(null);

  const pageWidthIn = pageWidthPx / FLOW_DPI;
  const pageHeightIn = pageHeightPx / FLOW_DPI;
  const scale = Math.max(0.01, zoom / 100);
  const leftPx = margins.leftInches * FLOW_DPI * scale;
  const rightPx = margins.rightInches * FLOW_DPI * scale;
  const topPx = margins.topInches * FLOW_DPI * scale;
  const bottomPx = margins.bottomInches * FLOW_DPI * scale;

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) {
      return;
    }

    function sync() {
      const scroller = scrollRef.current;
      const page = scroller?.querySelector(pageSelector) as HTMLElement | null;
      const hViewport = hViewportRef.current;
      const vViewport = vViewportRef.current;
      if (!scroller || !page || !hViewport || !vViewport) {
        return;
      }
      const pageRect = page.getBoundingClientRect();
      const hRect = hViewport.getBoundingClientRect();
      const vRect = vViewport.getBoundingClientRect();
      setAlign({
        leftInViewport: pageRect.left - hRect.left,
        scaledWidth: pageRect.width,
        pages: measureVerticalPageBands(
          page,
          pageRect,
          vRect,
          pageHeightPx * scale,
          pageCount,
        ),
      });
    }

    sync();
    scrollEl.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(scrollEl);
    const page = scrollEl.querySelector(pageSelector);
    if (page) {
      ro?.observe(page);
    }
    const pagination = page?.querySelector("[data-rm-pagination]");
    const mo =
      typeof MutationObserver !== "undefined" && pagination
        ? new MutationObserver(() => {
            sync();
          })
        : null;
    mo?.observe(pagination as Node, { childList: true, subtree: true });
    return () => {
      scrollEl.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [pageCount, pageHeightPx, pageSelector, scale, scrollRef, zoom]);

  useEffect(() => {
    if (!drag) {
      return;
    }
    function onMove(event: PointerEvent) {
      if (!drag) {
        return;
      }
      const deltaPx =
        drag.edge === "left" || drag.edge === "right"
          ? event.clientX - drag.startClient
          : event.clientY - drag.startClient;
      const deltaIn = deltaPx / (FLOW_DPI * scale);
      let nextInches = drag.startInches;
      if (drag.edge === "left" || drag.edge === "top") {
        nextInches = drag.startInches + deltaIn;
      } else {
        nextInches = drag.startInches - deltaIn;
      }
      onChangeRef.current(
        setFlowMarginEdge(marginsRef.current, drag.edge, nextInches, pageWidthIn, pageHeightIn),
      );
    }
    function onUp() {
      setDrag(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, pageHeightIn, pageWidthIn, scale]);

  function beginDrag(edge: FlowMarginEdge, client: number) {
    if (locked) {
      return;
    }
    const startInches =
      edge === "top"
        ? margins.topInches
        : edge === "right"
          ? margins.rightInches
          : edge === "bottom"
            ? margins.bottomInches
            : margins.leftInches;
    setDrag({ edge, startClient: client, startInches });
  }

  return (
    <>
      <div className="flow-ruler-corner" aria-hidden />
      <div ref={hViewportRef} className="flow-ruler-h-viewport" aria-hidden>
        <div
          className="flow-ruler-horizontal"
          style={{
            width: align.scaledWidth,
            transform: `translateX(${align.leftInViewport}px)`,
          }}
        >
          <div className="flow-ruler-margin flow-ruler-margin--h-left" style={{ width: leftPx }} />
          <div className="flow-ruler-margin flow-ruler-margin--h-right" style={{ width: rightPx }} />
          <div className="flow-ruler-ticks flow-ruler-ticks--h">{renderInchTicks(pageWidthIn, "h", scale)}</div>
          <button
            type="button"
            className="flow-ruler-handle flow-ruler-handle--left"
            style={{ left: leftPx }}
            aria-label={`Left margin ${margins.leftInches.toFixed(2)} inches`}
            disabled={locked}
            onPointerDown={(event) => {
              event.preventDefault();
              beginDrag("left", event.clientX);
            }}
          />
          <button
            type="button"
            className="flow-ruler-handle flow-ruler-handle--right"
            style={{ left: align.scaledWidth - rightPx }}
            aria-label={`Right margin ${margins.rightInches.toFixed(2)} inches`}
            disabled={locked}
            onPointerDown={(event) => {
              event.preventDefault();
              beginDrag("right", event.clientX);
            }}
          />
        </div>
      </div>
      <div ref={vViewportRef} className="flow-ruler-v-viewport" aria-hidden>
        {align.pages.map((band, index) => (
          <div
            key={`v-page-${index}`}
            className="flow-ruler-vertical"
            style={{
              height: band.height,
              transform: `translateY(${band.topInViewport}px)`,
            }}
          >
            <div className="flow-ruler-margin flow-ruler-margin--v-top" style={{ height: topPx }} />
            <div className="flow-ruler-margin flow-ruler-margin--v-bottom" style={{ height: bottomPx }} />
            <div className="flow-ruler-ticks flow-ruler-ticks--v">{renderInchTicks(pageHeightIn, "v", scale)}</div>
            <button
              type="button"
              className="flow-ruler-handle flow-ruler-handle--top"
              style={{ top: topPx }}
              aria-label={`Top margin ${margins.topInches.toFixed(2)} inches`}
              disabled={locked}
              onPointerDown={(event) => {
                event.preventDefault();
                beginDrag("top", event.clientY);
              }}
            />
            <button
              type="button"
              className="flow-ruler-handle flow-ruler-handle--bottom"
              style={{ top: Math.max(0, band.height - bottomPx) }}
              aria-label={`Bottom margin ${margins.bottomInches.toFixed(2)} inches`}
              disabled={locked}
              onPointerDown={(event) => {
                event.preventDefault();
                beginDrag("bottom", event.clientY);
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/** Build one vertical-ruler band per paper page, skipping pagination gaps. */
function measureVerticalPageBands(
  page: HTMLElement,
  pageRect: DOMRect,
  vRect: DOMRect,
  fallbackPageHeight: number,
  pageCountHint = 1,
): PageBand[] {
  const breakCount = Math.max(
    1,
    pageCountHint,
    page.querySelectorAll("[data-rm-pagination] > .rm-page-break").length,
  );

  const gapEl = [...page.querySelectorAll(".rm-pagination-gap")].find((el) => {
    const node = el as HTMLElement;
    return node.offsetHeight > 0 && getComputedStyle(node).display !== "none";
  }) as HTMLElement | undefined;

  if (!gapEl) {
    const bands: PageBand[] = [];
    for (let i = 0; i < breakCount; i += 1) {
      bands.push({
        topInViewport: pageRect.top - vRect.top + i * fallbackPageHeight,
        height:
          breakCount <= 1
            ? Math.min(pageRect.height, fallbackPageHeight) || fallbackPageHeight
            : fallbackPageHeight,
      });
    }
    return bands;
  }

  if (breakCount <= 1) {
    return [
      {
        topInViewport: pageRect.top - vRect.top,
        height: Math.min(pageRect.height, fallbackPageHeight) || fallbackPageHeight,
      },
    ];
  }

  const gapRect = gapEl.getBoundingClientRect();
  const measuredFirstPage = gapRect.top - pageRect.top;
  const pageBandHeight =
    measuredFirstPage > fallbackPageHeight * 0.5 ? measuredFirstPage : fallbackPageHeight;
  const gapHeight = gapRect.height;
  const stride = pageBandHeight + gapHeight;

  const bands: PageBand[] = [];
  for (let i = 0; i < breakCount; i += 1) {
    bands.push({
      topInViewport: pageRect.top - vRect.top + i * stride,
      height: pageBandHeight,
    });
  }
  return bands;
}

function renderInchTicks(lengthInches: number, axis: "h" | "v", scale: number) {
  const ticks = [];
  const max = Math.ceil(lengthInches);
  for (let inch = 0; inch <= max; inch += 1) {
    if (inch > lengthInches) {
      break;
    }
    const pos = inch * FLOW_DPI * scale;
    ticks.push(
      <span
        key={`i-${inch}`}
        className={`flow-ruler-tick flow-ruler-tick--major flow-ruler-tick--${axis}`}
        style={axis === "h" ? { left: pos } : { top: pos }}
      >
        {inch > 0 ? <span className="flow-ruler-label">{inch}</span> : null}
      </span>,
    );
    for (let eighth = 1; eighth < 8; eighth += 1) {
      const sub = inch + eighth / 8;
      if (sub >= lengthInches) {
        break;
      }
      const subPos = sub * FLOW_DPI * scale;
      const size = eighth === 4 ? "mid" : "minor";
      ticks.push(
        <span
          key={`s-${inch}-${eighth}`}
          className={`flow-ruler-tick flow-ruler-tick--${size} flow-ruler-tick--${axis}`}
          style={axis === "h" ? { left: subPos } : { top: subPos }}
        />,
      );
    }
  }
  return ticks;
}
