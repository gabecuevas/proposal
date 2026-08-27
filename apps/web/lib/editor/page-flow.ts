export type FlowLine = {
  /** Content Y of the top of the line, ignoring visual page-gap spacers. */
  contentTop: number;
  /** Content Y of the bottom of the line. */
  contentBottom: number;
  /** Document position at the start of the line. */
  pos: number;
};

/**
 * Packs measured lines into pages of `contentHeight`. Returns document positions
 * where a page break must be inserted *before* the overflowing line so the
 * same block (for example a text box) can continue on the next sheet.
 */
export function flowBreakPositions(lines: FlowLine[], contentHeight: number): number[] {
  if (contentHeight <= 0 || lines.length === 0) {
    return [];
  }

  const breaks: number[] = [];
  let pageStart = 0;

  for (const line of lines) {
    const height = Math.max(0, line.contentBottom - line.contentTop);
    if (height <= 0) {
      continue;
    }

    const fits = line.contentBottom - pageStart <= contentHeight + 0.5;
    if (fits) {
      continue;
    }

    const startsOnThisPage = line.contentTop - pageStart > 0.5;
    if (!startsOnThisPage) {
      // A single line taller than a page: leave it on this sheet and continue.
      pageStart = line.contentTop + contentHeight;
      continue;
    }

    if (line.pos > 1 && breaks.at(-1) !== line.pos) {
      breaks.push(line.pos);
    }
    pageStart = line.contentTop;
  }

  return breaks;
}

/**
 * Page-backed uploads already have one `pageBreak` per original PDF page.
 * Overflow measurement of those full-sheet images would add extra visual
 * pages, so pagination uses only the explicit breaks.
 *
 * Extra or missing `pageBreak` nodes (common after delete/duplicate) must not
 * change the painted gap: seams are placed before each canvas after the first.
 */
export function selectPageFlowBreaks(forced: number[], overflow: number[], pageBacked: boolean): number[] {
  const source = pageBacked ? forced : [...forced, ...overflow];
  return [...new Set(source)].sort((a, b) => a - b);
}

export type PageFlowTopLevel = { type: string; pos: number };

/**
 * Grey-gap spacer positions for a PDF-backed document: one seam before every
 * page canvas except the first. Leftover or duplicate pageBreak nodes are
 * ignored so delete-page cannot open a hole between sheets.
 */
export function canvasSeamPositions(nodes: PageFlowTopLevel[]): number[] {
  const positions: number[] = [];
  let first = true;
  for (const node of nodes) {
    if (node.type === "fieldOverlay") {
      continue;
    }
    if (node.type !== "fieldCanvas") {
      continue;
    }
    if (!first) {
      positions.push(node.pos);
    }
    first = false;
  }
  return positions;
}

/** Subtracts spacer heights above a visual Y so pagination sees a continuous flow. */
export function contentOffsetFromVisual(
  visualY: number,
  paddingTop: number,
  spacerHeightsAbove: number,
): number {
  return visualY - paddingTop - spacerHeightsAbove;
}
