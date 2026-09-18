/**
 * Local-only Flow Document Phase 1A fidelity harness.
 *
 * Usage (from apps/web):
 *   pnpm exec tsx lib/flow-document/scripts/local-fidelity-harness.ts
 *
 * Bundles TipTap + PaginationPlus into a headless Chromium page, loads synthetic
 * fixtures, measures editor page widgets, runs insert/delete/undo/JSON reload,
 * and exports PDFs for page-count comparison.
 *
 * This is NOT Google Docs clipboard testing.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { FLOW_FIXTURES, type FlowFixtureId } from "../fixtures";

/** Matches tiptap-pagination-plus PAGE_SIZES.LETTER (avoid Node ESM named-export interop). */
const LETTER_PAGE = {
  pageHeight: 1060,
  pageWidth: 818,
  marginTop: 96,
  marginBottom: 96,
  marginLeft: 96,
  marginRight: 96,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../../..");
const cacheDir = path.join(webRoot, "node_modules", ".cache", "flow-prototype");
const bundlePath = path.join(cacheDir, "harness-browser.js");
const reportPath = path.join(cacheDir, "fidelity-report.json");

type HarnessSnapshot = {
  fixtureId: FlowFixtureId;
  paper: string;
  editorPageCount: number;
  explicitBreakNodes: number;
  explicitBreaksInJson: number;
  scrollHeight: number;
  plainTextLength: number;
  html: string;
  json: string;
};

type FixtureResult = {
  fixtureId: FlowFixtureId;
  editorPageCount: number;
  pdfPageCount: number | null;
  pageCountMatch: boolean | null;
  expectedPagesHint: number;
  explicitBreaksInJson: number;
  explicitBreakNodes: number;
  setContentMs: number;
  paginationSettleMs: number;
  ops: {
    insertUndoOk: boolean;
    jsonReloadOk: boolean;
    pageBreakInsertIncreasesJsonBreaks: boolean;
    pageBreakInsertIncreasesEditorPages: boolean | null;
  };
  notes: string[];
  pdfFile?: string;
};

function resolveEsbuildBin(): string {
  const require = createRequire(path.join(webRoot, "package.json"));
  try {
    return require.resolve("esbuild/bin/esbuild");
  } catch {
    // esbuild is hoisted under the monorepo (tsx/vite), not apps/web.
  }
  const monorepoRoot = path.resolve(webRoot, "..");
  const monorepoRequire = createRequire(path.join(monorepoRoot, "package.json"));
  try {
    return monorepoRequire.resolve("esbuild/bin/esbuild");
  } catch {
    // continue
  }
  const pnpmBin = path.join(
    monorepoRoot,
    "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild",
  );
  if (existsSync(pnpmBin)) {
    return pnpmBin;
  }
  throw new Error("Could not resolve esbuild binary for Flow fidelity harness bundling");
}

function bundleHarness() {
  mkdirSync(cacheDir, { recursive: true });
  const esbuildBin = resolveEsbuildBin();
  const entry = path.join(__dirname, "harness-browser-entry.ts");
  const result = spawnSync(
    esbuildBin,
    [
      entry,
      "--bundle",
      "--format=iife",
      "--platform=browser",
      "--target=es2020",
      `--outfile=${bundlePath}`,
      `--alias:@=${webRoot}`,
      "--external:server-only",
    ],
    { cwd: webRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`esbuild failed:\n${result.stderr || result.stdout}`);
  }
}

function harnessHtml(script: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Flow Document Fidelity Harness</title>
  <style>
    html, body { margin: 0; padding: 16px; background: #e4e4e7; font-family: "Liberation Serif", "Times New Roman", Times, serif; }
    #flow-harness-mount { background: #fff; }
    .flow-document-editor {
      min-height: 400px;
      color: #18181b;
      font-size: 15px;
      line-height: 1.5;
    }
    .flow-document-editor .flow-page-break {
      display: block;
      height: 24px;
      margin: 8px 0;
      border-top: 1px dashed #a1a1aa;
    }
    .flow-document-editor table { border-collapse: collapse; width: 100%; }
    .flow-document-editor td, .flow-document-editor th {
      border: 1px solid #d4d4d8;
      padding: 0.35rem 0.5rem;
      vertical-align: top;
    }
    .flow-document-editor img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div id="flow-harness-mount"></div>
  <script>${script}</script>
</body>
</html>`;
}

function printHtmlFromEditor(bodyHtml: string): string {
  const size = LETTER_PAGE;
  const widthIn = size.pageWidth / 96;
  const heightIn = size.pageHeight / 96;
  const marginTopIn = size.marginTop / 96;
  const marginBottomIn = size.marginBottom / 96;
  const marginLeftIn = size.marginLeft / 96;
  const marginRightIn = size.marginRight / 96;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
@page {
  size: ${widthIn}in ${heightIn}in;
  margin: ${marginTopIn}in ${marginRightIn}in ${marginBottomIn}in ${marginLeftIn}in;
}
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Liberation Serif", "Times New Roman", Times, serif;
  font-size: 15px;
  line-height: 1.5;
  color: #18181b;
}
article { max-width: 100%; }
p { margin: 0 0 0.75rem; orphans: 2; widows: 2; }
h1 { font-size: 1.75rem; margin: 0 0 0.75rem; }
h2 { font-size: 1.35rem; margin: 1rem 0 0.5rem; }
h3 { font-size: 1.15rem; margin: 0.85rem 0 0.4rem; }
ul, ol { margin: 0 0 0.75rem; padding-left: 1.5rem; }
table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
td, th { border: 1px solid #d4d4d8; padding: 0.35rem 0.5rem; vertical-align: top; }
img { max-width: 100%; height: auto; }
.flow-page-break, [data-flow-page-break] {
  break-before: page;
  page-break-before: always;
  height: 0;
  margin: 0;
  border: 0;
  overflow: hidden;
}
.rm-with-pagination, [data-rm-pagination], .rm-page-break, .rm-pagination-gap,
.rm-page-header, .rm-page-footer, .rm-first-page-header, .rm-br-decoration {
  display: none !important;
}
</style>
</head>
<body>
<article class="flow-print">${bodyHtml}</article>
</body>
</html>`;
}

async function countPdfPages(pdf: Buffer): Promise<number> {
  const require = createRequire(import.meta.url);
  const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjs = await import(pdfjsPath);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
  const doc = await loadingTask.promise;
  const pages = doc.numPages;
  if (typeof doc.destroy === "function") {
    await doc.destroy();
  } else if (typeof doc.cleanup === "function") {
    doc.cleanup();
  }
  return pages;
}

async function main() {
  const startedAt = new Date().toISOString();
  bundleHarness();
  const script = readFileSync(bundlePath, "utf8");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  await page.setContent(harnessHtml(script), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__flowHarness?.ready === true);

  const fixtureIds = (await page.evaluate(() => window.__flowHarness.fixtures)) as FlowFixtureId[];
  const results: FixtureResult[] = [];
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: webRoot,
    playwright: "chromium-headless",
    paginationPackage: "tiptap-pagination-plus@2.1.0",
    note: "Synthetic fixtures only; not Google Docs clipboard testing.",
  };

  for (const fixtureId of fixtureIds) {
    const notes: string[] = [];
    const t0 = Date.now();
    const snap = (await page.evaluate(async (id) => {
      return window.__flowHarness.loadFixture(id, "letter");
    }, fixtureId)) as HarnessSnapshot;
    const paginationSettleMs = Date.now() - t0;

    // Insert / undo near start
    const beforeTextLen = snap.plainTextLength;
    await page.evaluate(() => window.__flowHarness.insertNearStart("ZZZ_BOUNDARY_MARKER "));
    await page.evaluate(() => window.__flowHarness.waitForPagination(600));
    const afterInsert = (await page.evaluate(() => window.__flowHarness.snapshot())) as HarnessSnapshot;
    await page.evaluate(() => window.__flowHarness.undo());
    await page.evaluate(() => window.__flowHarness.waitForPagination(600));
    const afterUndo = (await page.evaluate(() => window.__flowHarness.snapshot())) as HarnessSnapshot;
    const insertUndoOk =
      afterInsert.plainTextLength > beforeTextLen &&
      Math.abs(afterUndo.plainTextLength - beforeTextLen) <= 2;

    // JSON reload
    const json = afterUndo.json;
    await page.evaluate((raw) => window.__flowHarness.reloadFromJson(raw), json);
    const afterReload = (await page.evaluate(async () => {
      return window.__flowHarness.waitForPagination(800);
    })) as HarnessSnapshot;
    const jsonReloadOk =
      afterReload.plainTextLength === afterUndo.plainTextLength &&
      afterReload.explicitBreaksInJson === afterUndo.explicitBreaksInJson;

    // Page break insert effect
    const beforeBreakPages = afterReload.editorPageCount;
    const beforeBreakJson = afterReload.explicitBreaksInJson;
    await page.evaluate(() => window.__flowHarness.insertPageBreakAtEnd());
    const afterBreak = (await page.evaluate(async () => {
      return window.__flowHarness.waitForPagination(1000);
    })) as HarnessSnapshot;
    const pageBreakInsertIncreasesJsonBreaks =
      afterBreak.explicitBreaksInJson === beforeBreakJson + 1;
    const pageBreakInsertIncreasesEditorPages =
      afterBreak.editorPageCount > beforeBreakPages
        ? true
        : afterBreak.editorPageCount === beforeBreakPages
          ? false
          : null;
    if (pageBreakInsertIncreasesEditorPages === false) {
      notes.push(
        "Inserting Flow pageBreak did not increase PaginationPlus widget page count — manual breaks are not first-class in PaginationPlus without a filler/spacer strategy.",
      );
    }

    // Restore fixture for PDF baseline (clean load)
    const cleanT0 = Date.now();
    const clean = (await page.evaluate(async (id) => {
      return window.__flowHarness.loadFixture(id, "letter");
    }, fixtureId)) as HarnessSnapshot;
    const setContentMs = Date.now() - cleanT0;

    // PDF from editor HTML (content + CSS page breaks on .flow-page-break), not decorative seams.
    let pdfPageCount: number | null = null;
    let pageCountMatch: boolean | null = null;
    let pdfFile: string | undefined;
    try {
      const html = printHtmlFromEditor(clean.html);
      const pdfPage = await browser.newPage();
      await pdfPage.setContent(html, { waitUntil: "networkidle" });
      const pdfBuffer = Buffer.from(
        await pdfPage.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        }),
      );
      await pdfPage.close();
      pdfFile = path.join(cacheDir, `${fixtureId}.pdf`);
      writeFileSync(pdfFile, pdfBuffer);
      pdfPageCount = await countPdfPages(pdfBuffer);
      pageCountMatch = pdfPageCount === clean.editorPageCount;
      if (!pageCountMatch) {
        notes.push(
          `Editor PaginationPlus pages (${clean.editorPageCount}) ≠ Chromium print PDF pages (${pdfPageCount}). Print uses CSS @page + break-before on .flow-page-break; it does not replay PaginationPlus float/gap chrome.`,
        );
      }
    } catch (error) {
      notes.push(`PDF export failed: ${error instanceof Error ? error.message : String(error)}`);
      pageCountMatch = null;
    }

    if (fixtureId === "long-table") {
      notes.push(
        "TablePlus is not present in tiptap-pagination-plus@2.1.0 build used here; row-level table split across pages is unverified.",
      );
    }
    if (fixtureId === "stress-50-pages") {
      notes.push(
        `Stress timing: load+paginate wall ${setContentMs}ms (includes harness wait); editorPageCount=${clean.editorPageCount}, hint=${FLOW_FIXTURES[fixtureId].expectedPagesHint}.`,
      );
    }

    results.push({
      fixtureId,
      editorPageCount: clean.editorPageCount,
      pdfPageCount,
      pageCountMatch,
      expectedPagesHint: FLOW_FIXTURES[fixtureId].expectedPagesHint,
      explicitBreaksInJson: clean.explicitBreaksInJson,
      explicitBreakNodes: clean.explicitBreakNodes,
      setContentMs,
      paginationSettleMs,
      ops: {
        insertUndoOk,
        jsonReloadOk,
        pageBreakInsertIncreasesJsonBreaks,
        pageBreakInsertIncreasesEditorPages,
      },
      notes,
      pdfFile,
    });
  }

  await browser.close();

  const summary = {
    ok: results.every((r) => r.ops.insertUndoOk && r.ops.jsonReloadOk),
    allPageCountsMatch: results.every((r) => r.pageCountMatch === true),
    startedAt,
    finishedAt: new Date().toISOString(),
    environment,
    results,
    limitations: [
      "Automated fixture coverage only — not Google Docs / Word clipboard fidelity.",
      "PDF path compares PaginationPlus widget count to Chromium CSS print pagination of getHTML(); matching is required for pass but may fail when engines disagree.",
      "Cross-page drag selection is not automated here (requires interactive browser).",
      "No TablePlus — long-table split behavior unverified.",
      "TipTap Pro Pages not publicly installable without credentials.",
    ],
  };

  writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
