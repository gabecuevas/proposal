/**
 * Local-only Flow Document PDF smoke helper (Phase 1A).
 *
 * Usage (from repo root, after `pnpm --filter web exec` / tsx):
 *   pnpm --filter web exec tsx lib/flow-document/scripts/local-pdf-smoke.ts
 *
 * Renders a simple HTML print approximation of the short-agreement fixture
 * through Playwright. This is NOT a claim that PaginationPlus editor seams
 * match PDF pagination — it only verifies the local PDF toolchain works for
 * Flow prototype HTML.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { FLOW_FIXTURES } from "../fixtures";
import { extractFlowPlainText } from "../serialize";
import { renderBodyHtmlToPdf } from "@/lib/editor/render-pdf";

async function main() {
  const fixture = FLOW_FIXTURES["short-agreement"];
  const text = extractFlowPlainText(fixture.doc);
  const bodyHtml = `
    <article class="flow-pdf-smoke">
      <h1>${fixture.title}</h1>
      <p><em>Phase 1A local PDF smoke — synthetic fixture text only.</em></p>
      <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:12pt;line-height:1.4">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>
    </article>
  `;

  const started = Date.now();
  const pdf = await renderBodyHtmlToPdf({
    bodyHtml,
    pageSize: "letter",
    title: fixture.title,
  });
  const outDir = path.join(process.cwd(), "node_modules", ".cache", "flow-prototype");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "short-agreement-smoke.pdf");
  writeFileSync(outFile, pdf);
  console.log(
    JSON.stringify(
      {
        ok: true,
        bytes: pdf.byteLength,
        ms: Date.now() - started,
        outFile,
        note: "Plain-text PDF smoke only; not editor pagination parity.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
