import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getCommercialDocument } from "@/lib/commercial/store";
import { renderCommercialDocumentHtml } from "@/lib/commercial/render-html";
import { renderHtmlToPdfBuffer } from "@/lib/editor/render-pdf";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const document = await getCommercialDocument(documentId, auth.workspaceId);
  if (!document) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Document not found" });
  }

  const html = renderCommercialDocumentHtml({
    commercial: document.commercial,
    context: document.variables_json as Record<string, unknown>,
    finalized: true,
    amountPaidMinorOverride: document.paidFromLedgerMinor || undefined,
  });

  try {
    const pdf = await renderHtmlToPdfBuffer(html);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.commercial.type}-${document.commercial.documentNumber || document.id}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF render failed";
    return errorResponse(request, { status: 502, code: "pdf_failed", message });
  }
}
