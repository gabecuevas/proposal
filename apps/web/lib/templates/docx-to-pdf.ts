import { renderBodyHtmlToPdf } from "@/lib/editor/render-pdf";
import { convertDocxBufferToHtml } from "@/lib/templates/docx-to-editor";

/**
 * Convert a DOCX (including Google Docs export) into a multi-page PDF.
 * Uses mammoth → HTML (with Title centering + solid signature lines) → Playwright.
 */
export async function convertDocxBufferToPdf(
  buffer: Buffer,
  title = "Document",
): Promise<Buffer> {
  const html = await convertDocxBufferToHtml(buffer);
  return renderBodyHtmlToPdf({ bodyHtml: html, pageSize: "letter", title });
}
