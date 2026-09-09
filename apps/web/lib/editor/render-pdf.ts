import { wrapPrintHtml } from "@/lib/editor/print-document";
import type { PageSizeId } from "@/lib/editor/page-geometry";

const PAGE_SIZE_IDS = new Set<string>(["letter", "legal", "a4"]);

export function normalizePageSize(value: unknown): PageSizeId {
  if (typeof value === "string" && PAGE_SIZE_IDS.has(value as PageSizeId)) {
    return value as PageSizeId;
  }
  return "letter";
}

async function renderPdfWithPlaywright(html: string): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function renderPdfViaWorker(html: string): Promise<Buffer> {
  const workerUrl = process.env.WORKER_PDF_RENDER_URL?.trim();
  if (!workerUrl) {
    throw new Error("WORKER_PDF_RENDER_URL is not configured");
  }
  const secret = process.env.WORKER_PDF_RENDER_SECRET?.trim();
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Worker PDF render failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Renders print HTML to PDF bytes via worker proxy or local Playwright. */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  if (process.env.WORKER_PDF_RENDER_URL?.trim()) {
    return renderPdfViaWorker(html);
  }
  return renderPdfWithPlaywright(html);
}

export async function renderBodyHtmlToPdf(input: {
  bodyHtml: string;
  pageSize?: unknown;
  title?: string;
}): Promise<Buffer> {
  const html = wrapPrintHtml(input.bodyHtml, normalizePageSize(input.pageSize), input.title ?? "Document");
  return renderHtmlToPdfBuffer(html);
}
